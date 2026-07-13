"""
rag-recommender -- API Gateway (HTTP API) -> Lambda -> Bedrock Cohere Embed Multilingual
v3 -> Supabase pgvector RPC search_similar_content().

Theo emotion label cua phien Focus vua ket thuc -> goi y noi dung tuong tu (sutra/
quote/video) tu media_library. KHONG dong goi ML, dung Bedrock Cohere Embed Multilingual
v3 (cung model/chieu voi admin-vectorizer -- BAT BUOC cung 1024 chieu, khac chieu la RPC
loi ngay vi kieu du lieu VECTOR(1024) khong khop). Model nay co san NGAY TAI
ap-southeast-1 (da verify that, xem aws/lambdas/admin-vectorizer/lambda_function.py
docstring de biet ly do chon Cohere thay Titan) -- Lambda goi Bedrock CUNG REGION voi
chinh no, khong can cross-region/inference profile.

AUTH (user thuong, KHONG can admin -- cung pattern voi emotion-detector): Bearer
token -> Supabase PostgREST tu verify (moi thuat toan). Sau khi verify, Lambda goi
RPC search_similar_content() BANG CHINH TOKEN CUA CALLER (khong dung service_role) --
ham la SECURITY INVOKER (mac dinh Postgres) nen RLS `media_read_all` (moi authenticated
user doc duoc) van ap dung binh thuong, khong can quyen dac biet.

Input KHONG phai raw journal text -- chi co 1 trong 5 nhan emotion da chuan hoa (frontend
da chay useEmotionDetector truoc do). Vi vay map emotion -> 1 cau mo ta ngan (EMOTION_QUERY)
roi embed cau do, thay vi embed thang label 1-2 tu (embedding 1 cau co ngu canh chinh xac
hon 1 tu don le). Dung input_type="search_query" (khac voi admin-vectorizer dung
"search_document") -- Cohere embed BAT DOI XUNG giua query/document de tang do chinh xac
retrieval, day la khac biet co chu dich, khong phai loi.

Route: POST /rag   { "emotion": "stressed", "limit": 3 }
Tra ve: [ { id, title, content_text, content_url, type, source, similarity }, ... ]
(mang phang, KHONG boc trong object -- khop dung useRAG.ts hien tai: `response: any[]`)

Env: SUPABASE_URL, SUPABASE_ANON_KEY (bat buoc), ALLOWED_ORIGINS (CSV, optional),
     COHERE_MODEL_ID (mac dinh cohere.embed-multilingual-v3), EMBED_DIMENSIONS (mac dinh
     1024, PHAI khop VECTOR(1024) trong migration 00015 -- CUNG gia tri voi
     admin-vectorizer), MATCH_THRESHOLD (mac dinh 0.3).
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
MATCH_THRESHOLD = float(os.environ.get('MATCH_THRESHOLD', '0.3'))
MAX_LIMIT = 10
DEFAULT_LIMIT = 3

# Nhan emotion chuan (useEmotionDetector.ts) -> 1 cau mo ta ngan de embed lam query.
EMOTION_QUERY = {
    'focused': 'Content to help someone stay deeply focused and maintain productive momentum.',
    'stressed': 'Calming, soothing content to help relieve stress and anxiety.',
    'exhausted': 'Gentle, restorative content for someone who is mentally drained and needs to recover energy.',
    'relaxed': 'Peaceful content that complements a calm, relaxed state of mind.',
    'unmotivated': 'Inspiring, motivating content to help spark drive and overcome procrastination.',
}
DEFAULT_QUERY = 'Calming and encouraging content to support a healthy focus practice.'

_bedrock = None


class AuthError(Exception):
    def __init__(self, status, msg):
        super().__init__(msg)
        self.status = status
        self.msg = msg


def _bedrock_client():
    global _bedrock
    if _bedrock is None:
        _bedrock = boto3.client('bedrock-runtime')  # cung region voi Lambda (ap-southeast-1)
    return _bedrock


def _embed_query(text):
    body = json.dumps({'texts': [text], 'input_type': 'search_query', 'truncate': 'END'})
    resp = _bedrock_client().invoke_model(
        modelId=COHERE_MODEL_ID, body=body,
        contentType='application/json', accept='application/json',
    )
    payload = json.loads(resp['body'].read())
    vec = payload['embeddings'][0]
    if len(vec) != EMBED_DIMENSIONS:
        raise RuntimeError(f'Cohere tra ve {len(vec)} chieu, ky vong {EMBED_DIMENSIONS}.')
    return vec


# ── Auth (user thuong, giong emotion-detector) ────────────────────────────────

def _header(event, name):
    for k, v in (event.get('headers') or {}).items():
        if k.lower() == name:
            return v or ''
    return ''


def _method(event):
    return event.get('httpMethod') or event.get('requestContext', {}).get('http', {}).get('method', '')


def _sub(token):
    try:
        seg = token.split('.')[1]
        seg += '=' * (-len(seg) % 4)
        return json.loads(base64.urlsafe_b64decode(seg.encode())).get('sub')
    except Exception:
        return None


def _verify_user(event):
    if not (SUPABASE_URL and SUPABASE_ANON_KEY):
        raise AuthError(500, 'Auth backend chua cau hinh (SUPABASE_URL/ANON_KEY).')
    auth = _header(event, 'authorization')
    if not auth.lower().startswith('bearer '):
        raise AuthError(401, 'Thieu Authorization: Bearer token.')
    token = auth[7:].strip()
    sub = _sub(token)
    try:
        uuid.UUID(str(sub))
    except (ValueError, TypeError):
        raise AuthError(401, 'Token khong hop le (sub sai).')
    url = f'{SUPABASE_URL}/rest/v1/users?id=eq.{sub}&select=id'
    req = urllib.request.Request(url, headers={
        'apikey': SUPABASE_ANON_KEY, 'Authorization': f'Bearer {token}', 'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            rows = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            raise AuthError(401, 'Token khong hop le hoac da het han.')
        raise AuthError(403, f'Xac thuc that bai (HTTP {e.code}).')
    except Exception as e:  # noqa: BLE001
        raise AuthError(403, f'Xac thuc that bai: {e}')
    if not rows:
        raise AuthError(401, 'Token khong gan voi tai khoan hop le.')
    return token


def _search_similar(token, query_embedding, match_count):
    """RPC search_similar_content() -- SECURITY INVOKER mac dinh nen chay duoi quyen
    caller, RLS media_read_all van ap dung (khong can service_role)."""
    url = f'{SUPABASE_URL}/rest/v1/rpc/search_similar_content'
    body = json.dumps({
        'query_embedding': query_embedding,
        'match_threshold': MATCH_THRESHOLD,
        'match_count': match_count,
        'filter_type': None,
    }).encode()
    req = urllib.request.Request(url, data=body, headers={
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        # PostgREST tra chi tiet loi (vd 42804 type mismatch) trong response BODY, khong
        # phai trong e.__str__() -- doc them de log/message ro nghia thay vi "400: Bad Request".
        detail = e.read().decode(errors='replace')
        raise RuntimeError(f'search_similar_content RPC that bai (HTTP {e.code}): {detail}') from e


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


def handler(event, context):
    if _method(event) == 'OPTIONS':
        return _resp(200, {'ok': True}, event)
    try:
        token = _verify_user(event)

        body = json.loads(event.get('body') or '{}')
        emotion = str(body.get('emotion') or '').strip().lower()
        try:
            limit = max(1, min(MAX_LIMIT, int(body.get('limit', DEFAULT_LIMIT))))
        except (TypeError, ValueError):
            limit = DEFAULT_LIMIT

        query_text = EMOTION_QUERY.get(emotion, DEFAULT_QUERY)
        query_embedding = _embed_query(query_text)
        results = _search_similar(token, query_embedding, limit)
        return _resp(200, results, event)

    except AuthError as e:
        print(f'AUTH DENY {e.status}: {e.msg}')
        return _resp(e.status, {'message': e.msg}, event)
    except Exception as e:  # noqa: BLE001
        print(f'ERROR rag-recommender: {e}')
        return _resp(500, {'message': 'Loi noi bo, thu lai sau.'}, event)
