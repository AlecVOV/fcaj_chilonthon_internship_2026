"""
admin-vectorizer -- API Gateway (HTTP API) -> Lambda -> Bedrock Cohere Embed Multilingual v3.

Sinh embedding cho media_library (dung cho RAG) bang Bedrock Cohere Embed Multilingual
v3 (cohere.embed-multilingual-v3, 1024 chieu) -- KHONG dong goi model ML (sentence-
transformers) vao Lambda, tranh Lambda Layer/container phuc tap.

Chon Cohere multilingual v3 thay vi Titan Embed v2 (ban dau) vi: (1) Titan KHONG co san
o ap-southeast-1 (da verify qua `aws bedrock list-foundation-models --region
ap-southeast-1` -- chi co Claude/Nova/Cohere), phai goi cross-region sang us-east-1;
(2) Cohere Embed English v3 / Multilingual v3 co san NGAY TAI ap-southeast-1 (da verify
that qua get-foundation-model + 1 lan invoke-model that -- ca 2 deu ra dung 1024 chieu,
KHONG can inference profile khac voi cohere.embed-v4:0 -- model do YEU CAU
INFERENCE_PROFILE, phuc tap hon); (3) ban multilingual xu ly duoc ca tieng Viet (da test
that voi 1 cau tieng Viet, van ra dung 1024 chieu) -- phu hop app hien thi tieng Viet.
Ket qua: Lambda nay goi Bedrock CUNG REGION voi chinh no (khong can cross-region, khong
can BEDROCK_REGION rieng).

AUTH (admin-only, cung pattern voi ambient-audio-manager): Bearer token -> de Supabase
PostgREST tu verify (moi thuat toan, ke ca ES256) qua
GET /rest/v1/users?id=eq.{sub}&select=id,role -- role phai la 'admin'.

Sau khi authorize, Lambda GOI LAI PostgREST BANG CHINH TOKEN CUA CALLER (khong dung
service_role) de doc/ghi media_library -- RLS (`media_read_all`, `media_write_admin`/
`media_update_admin`, deu dua vao is_admin()) la lop kiem tra THU HAI doc lap; Lambda
KHONG can SUPABASE_SERVICE_ROLE_KEY nen giam be mat secret.

Route:
  POST /embed      { "mediaId": "<uuid>" }   -> embed 1 item, tra {mediaId, dimensions}
  POST /embed-all   {}                        -> embed MOI item con embedding_vector NULL
                                                   trong 1 lan goi Cohere (batch, texts la
                                                   list) roi ghi tung dong, tra {count: N}

Input embed = title + content_text (ghep lai) -- de co ca video/quote thieu
content_text van co it nhat title de embed (khong bo qua item nao).

Env: SUPABASE_URL, SUPABASE_ANON_KEY (bat buoc, dung ca cho auth-check lan doc/ghi
     media_library), ALLOWED_ORIGINS (CSV, optional), COHERE_MODEL_ID (mac dinh
     cohere.embed-multilingual-v3), EMBED_DIMENSIONS (mac dinh 1024, PHAI khop
     VECTOR(1024) trong migration 00015).
"""

import base64
import json
import os
import urllib.error
import urllib.request
import uuid

import boto3

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY', '')
ALLOWED_ORIGINS = [o.strip() for o in os.environ.get('ALLOWED_ORIGINS', '').split(',') if o.strip()]
COHERE_MODEL_ID = os.environ.get('COHERE_MODEL_ID', 'cohere.embed-multilingual-v3')
EMBED_DIMENSIONS = int(os.environ.get('EMBED_DIMENSIONS', '1024'))
MAX_INPUT_CHARS = 2000  # Bedrock Cohere embed CHAN CUNG o 2048 ky tu/text (verify that: gui
# >2048 -> ValidationException, "truncate":"END" KHONG cuu duoc vi day la gioi han request-
# validation cua Bedrock, khac voi truncate noi bo cua model). Voi noi dung dai (bai giang/
# transcript nhieu doan), 2000 ky tu dau chi la 1 phan nho -- xem
# docs/ai-features-roadmap.md muc 5 (KB ingestion) de biet chi tiet + huong xu ly (chunking).
MAX_BATCH = 50  # /embed-all cap so item xu ly 1 lan (Cohere cho toi 96 texts/call)

_bedrock = None


class AuthError(Exception):
    def __init__(self, status, msg):
        super().__init__(msg)
        self.status = status
        self.msg = msg


def _bedrock_client():
    global _bedrock
    if _bedrock is None:
        _bedrock = boto3.client('bedrock-runtime')  # cung region voi Lambda (ap-southeast-1) -- Cohere co san tai day
    return _bedrock


def _embed_texts(texts, input_type='search_document'):
    """Goi Cohere Embed Multilingual v3, tra list[list[float]] (1 vector/text, cung thu tu).
    texts la list -- co the goi 1 hoac nhieu text/lan (batch), toi da MAX_BATCH."""
    body = json.dumps({'texts': texts, 'input_type': input_type, 'truncate': 'END'})
    resp = _bedrock_client().invoke_model(
        modelId=COHERE_MODEL_ID, body=body,
        contentType='application/json', accept='application/json',
    )
    payload = json.loads(resp['body'].read())
    vectors = payload['embeddings']
    if len(vectors) != len(texts):
        raise RuntimeError(f'Cohere tra ve {len(vectors)} vector cho {len(texts)} text dau vao.')
    for v in vectors:
        if len(v) != EMBED_DIMENSIONS:
            raise RuntimeError(f'Cohere tra ve {len(v)} chieu, ky vong {EMBED_DIMENSIONS}.')
    return vectors


def _vector_literal(vec):
    """pgvector chap nhan string dang "[0.1,0.2,...]" qua PostgREST JSON string."""
    return '[' + ','.join(repr(float(x)) for x in vec) + ']'


# ── Auth (giong ambient-audio-manager, admin-only) ───────────────────────────

def _header(event, name):
    for k, v in (event.get('headers') or {}).items():
        if k.lower() == name:
            return v or ''
    return ''


def _method(event):
    return event.get('httpMethod') or event.get('requestContext', {}).get('http', {}).get('method', '')


def _bearer_token(event):
    auth = _header(event, 'authorization')
    if not auth.lower().startswith('bearer '):
        raise AuthError(401, 'Thieu Authorization: Bearer token.')
    return auth[7:].strip()


def _token_claim(token, seg_idx, key, default=None):
    """Doc claim trong JWT (KHONG verify chu ky -- token van duoc PostgREST verify
    that khi goi REST; sub/claim o day chi de dinh tuyen query."""
    try:
        seg = token.split('.')[seg_idx]
        seg += '=' * (-len(seg) % 4)
        return json.loads(base64.urlsafe_b64decode(seg.encode())).get(key, default)
    except Exception:
        return default


def _require_admin(token):
    sub = _token_claim(token, 1, 'sub')
    if not sub:
        raise AuthError(401, 'Token thieu sub.')
    url = f'{SUPABASE_URL}/rest/v1/users?id=eq.{sub}&select=id,role'
    req = urllib.request.Request(url, headers={
        'apikey': SUPABASE_ANON_KEY, 'Authorization': f'Bearer {token}', 'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            rows = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            raise AuthError(401, 'Token khong hop le hoac da het han.')
        raise AuthError(403, f'Supabase tu choi xac thuc (HTTP {e.code}).')
    except Exception as e:  # noqa: BLE001
        raise AuthError(403, f'Khong xac thuc duoc: {e}')
    if not rows:
        raise AuthError(401, 'Token khong gan voi tai khoan hop le.')
    role = rows[0].get('role')
    if role != 'admin':
        raise AuthError(403, f'Chi admin moi duoc tao embedding (role={role}).')


def _authorize(event):
    if not (SUPABASE_URL and SUPABASE_ANON_KEY):
        raise AuthError(500, 'Auth backend chua cau hinh (SUPABASE_URL/ANON_KEY).')
    token = _bearer_token(event)
    _require_admin(token)
    return token


# ── PostgREST helpers (dung CHINH token cua caller, khong dung service_role) ──

def _pg_request(method, path, token, body=None):
    url = f'{SUPABASE_URL}/rest/v1/{path}'
    headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': f'Bearer {token}',
        'Accept': 'application/json',
    }
    data = None
    if body is not None:
        headers['Content-Type'] = 'application/json'
        headers['Prefer'] = 'return=representation'
        data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=10) as r:
        raw = r.read().decode()
        return json.loads(raw) if raw else []


def _get_media(token, media_id):
    rows = _pg_request('GET', f'media_library?id=eq.{media_id}&select=id,title,content_text,type', token)
    return rows[0] if rows else None


def _list_unembedded(token, limit=MAX_BATCH):
    return _pg_request(
        'GET',
        f'media_library?embedding_vector=is.null&select=id,title,content_text,type&limit={limit}',
        token,
    )


def _write_embedding(token, media_id, vec):
    rows = _pg_request('PATCH', f'media_library?id=eq.{media_id}', token, body={'embedding_vector': _vector_literal(vec)})
    return bool(rows)  # rong -> RLS chan (khong phai admin) hoac id sai


def _embed_input_text(row):
    """title + content_text ghep lai -- dam bao video/quote thieu content_text van co it nhat title de embed."""
    parts = [p for p in (row.get('title'), row.get('content_text')) if p]
    return '\n\n'.join(parts).strip()[:MAX_INPUT_CHARS]


# ── HTTP plumbing ─────────────────────────────────────────────────────────────

def _cors(event):
    origin = _header(event, 'origin')
    if ALLOWED_ORIGINS:
        allow = origin if origin in ALLOWED_ORIGINS else ALLOWED_ORIGINS[0]
    else:
        allow = origin or '*'
    return {
        'Access-Control-Allow-Origin': allow,
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Vary': 'Origin',
    }


def _resp(status, body, event):
    return {'statusCode': status, 'headers': {'Content-Type': 'application/json', **_cors(event)}, 'body': json.dumps(body)}


def _path(event):
    return event.get('rawPath') or event.get('path') or event.get('resource') or ''


def handler(event, context):
    if _method(event) == 'OPTIONS':
        return _resp(200, {'ok': True}, event)

    path = _path(event)
    try:
        token = _authorize(event)

        if path.endswith('/embed-all'):
            rows = _list_unembedded(token)
            if not rows:
                return _resp(200, {'count': 0}, event)
            texts = [_embed_input_text(r) or (r.get('title') or '') for r in rows]
            vectors = _embed_texts(texts, input_type='search_document')  # 1 lan goi Cohere cho ca batch
            count = 0
            for row, vec in zip(rows, vectors):
                try:
                    if _write_embedding(token, row['id'], vec):
                        count += 1
                except Exception as e:  # noqa: BLE001 -- 1 item loi khong duoc chan ca batch
                    print(f'ERROR embed-all write {row.get("id")}: {e}')
            return _resp(200, {'count': count}, event)

        if path.endswith('/embed'):
            body = json.loads(event.get('body') or '{}')
            media_id = body.get('mediaId')
            try:
                uuid.UUID(str(media_id))
            except (ValueError, TypeError):
                return _resp(400, {'message': 'mediaId phai la UUID hop le.'}, event)

            row = _get_media(token, media_id)
            if not row:
                return _resp(404, {'message': 'Khong tim thay media.'}, event)
            text = _embed_input_text(row)
            if not text:
                return _resp(400, {'message': 'Media khong co title/content_text de embed.'}, event)

            vec = _embed_texts([text], input_type='search_document')[0]
            if not _write_embedding(token, media_id, vec):
                return _resp(403, {'message': 'Ghi that bai (RLS tu choi hoac media khong con ton tai).'}, event)
            return _resp(200, {'mediaId': media_id, 'dimensions': EMBED_DIMENSIONS}, event)

        return _resp(404, {'message': f'Khong khop route: {path}'}, event)

    except AuthError as e:
        print(f'AUTH DENY {e.status}: {e.msg}')
        return _resp(e.status, {'message': e.msg}, event)
    except Exception as e:  # noqa: BLE001
        print(f'ERROR admin-vectorizer: {e}')
        return _resp(500, {'message': 'Loi noi bo, thu lai sau.'}, event)
