"""
ambient-audio-manager
=====================
Backend cho Phần 1 (S3 File Management) của tính năng Ambient Sound.

Trình duyệt không ghi thẳng S3 được, nên Lambda này:
  POST /ambient/upload-url  -> trả presigned PUT URL để browser upload thẳng lên S3
  GET  /ambient/files       -> ListObjectsV2, trả danh sách file + public URL

Sau khi upload, admin copy public URL và thêm vào bảng ambient_sounds (Phần 2,
làm ở frontend qua Supabase). Lambda này KHÔNG đụng tới DB.

Env vars:
  AMBIENT_S3_BUCKET   (bắt buộc)  tên bucket, VD: focus-mode-ambient-audio
  AMBIENT_S3_PREFIX   (tùy chọn)  prefix/thư mục trong bucket, VD: "ambient/" (mặc định "")
  AWS_REGION          (Lambda tự set)
  SUPABASE_URL        (bật auth)  URL project Supabase, VD: https://xxx.supabase.co
  SUPABASE_ANON_KEY   (bật auth)  anon key (để đính apikey vào request PostgREST)

Xác thực (cách 2 — để Supabase tự validate token, thuật-toán-agnostic):
Có SUPABASE_URL + ANON_KEY = BẬT auth. Lambda KHÔNG tự verify chữ ký (tránh phụ thuộc
HS256 vs RS256/ES256). Thay vào đó lấy access_token từ header Authorization: Bearer rồi
gọi GET {SUPABASE_URL}/rest/v1/users?select=id,role kèm token đó — PostgREST verify token
bằng đúng khóa của project (bất kể thuật toán) và RLS `users_self_access` chỉ trả về CHÍNH
dòng của caller → đọc role. Token sai/hết hạn → PostgREST 401. role != 'admin' → 403.
Không set URL/ANON = endpoint public (không phá deploy đang chạy).
(Cách 1 — JWT authorizer ở API Gateway — xem DEPLOY-cmd.md, không dùng.)
"""

import base64
import json
import os
import re
import urllib.error
import urllib.request
import boto3
from urllib.parse import quote
from botocore.config import Config

REGION = os.environ.get('AWS_REGION', 'ap-southeast-1')
BUCKET = os.environ.get('AMBIENT_S3_BUCKET', 'focus-mode-ambient-audio')
PREFIX = os.environ.get('AMBIENT_S3_PREFIX', '')

# ── Auth (để Supabase validate token — cách 2) ───────────────────────────────
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')          # có URL + ANON = bật auth
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY', '')

# SigV4 + endpoint REGIONAL (virtual-hosted) để presigned URL ký đúng host
# https://<bucket>.s3.<region>.amazonaws.com — tránh endpoint global s3.amazonaws.com
# vốn bị S3 trả 301 redirect (browser PUT sẽ "network error" vì host đổi → sai chữ ký).
s3 = boto3.client(
    's3',
    region_name=REGION,
    endpoint_url=f'https://s3.{REGION}.amazonaws.com',
    config=Config(signature_version='s3v4', s3={'addressing_style': 'virtual'}),
)

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
}
AUDIO_EXT = ('.mp3', '.wav', '.m4a', '.ogg', '.aac', '.flac')


def _resp(status, body):
    return {
        'statusCode': status,
        'headers': {'Content-Type': 'application/json', **CORS},
        'body': json.dumps(body),
    }


def _method(event):
    return event.get('httpMethod') or event.get('requestContext', {}).get('http', {}).get('method', '')


def _path(event):
    # REST API (v1): 'resource'/'path'; HTTP API (v2): 'rawPath'
    return event.get('resource') or event.get('rawPath') or event.get('path', '') or ''


def _public_url(key):
    # Virtual-hosted-style — yêu cầu tên bucket hợp lệ DNS (chữ thường, gạch ngang,
    # KHÔNG gạch dưới). Object cần public-read (bucket policy) để phát được.
    return f'https://{BUCKET}.s3.{REGION}.amazonaws.com/{quote(key)}'


def _sanitize(filename):
    base = os.path.basename(filename or '').strip()
    base = re.sub(r'[^A-Za-z0-9._-]+', '_', base)  # bỏ khoảng trắng & ký tự lạ
    return base or 'audio.mp3'


# ── Auth helpers ─────────────────────────────────────────────────────────────
class AuthError(Exception):
    def __init__(self, status, msg):
        super().__init__(msg)
        self.status = status
        self.msg = msg


def _raw_auth_header(event):
    headers = event.get('headers') or {}
    for k, v in headers.items():               # key có thể hoa/thường tùy payload
        if k.lower() == 'authorization':
            return v or ''
    return ''


def _bearer_token(event):
    auth = _raw_auth_header(event)
    if not auth.lower().startswith('bearer '):
        raise AuthError(401, 'Thiếu Authorization: Bearer token.')
    return auth[7:].strip()


def _token_claim(token, seg_idx, key, default=None):
    """Đọc 1 claim trong JWT (header/payload) — KHÔNG verify, chỉ để lấy sub/alg.
    An toàn vì token vẫn được PostgREST verify khi gọi REST; sub chỉ dùng để
    khớp ĐÚNG dòng của caller trong kết quả (admin đọc được nhiều dòng)."""
    try:
        seg = token.split('.')[seg_idx]
        seg += '=' * (-len(seg) % 4)
        return json.loads(base64.urlsafe_b64decode(seg.encode())).get(key, default)
    except Exception:
        return default


def _require_admin_via_supabase(token):
    """Để PostgREST verify token (mọi thuật toán). RLS: user thường chỉ đọc dòng
    của mình; ADMIN đọc được TẤT CẢ dòng → phải khớp ĐÚNG dòng caller theo sub,
    KHÔNG dùng rows[0]."""
    sub = _token_claim(token, 1, 'sub')
    if not sub:
        raise AuthError(401, 'Token thiếu sub.')
    url = f'{SUPABASE_URL}/rest/v1/users?id=eq.{sub}&select=id,role'
    req = urllib.request.Request(url, headers={
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': f'Bearer {token}',
        'Accept': 'application/json',
    })
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            rows = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            raise AuthError(401, 'Token không hợp lệ hoặc đã hết hạn.')
        raise AuthError(403, f'Supabase từ chối xác thực (HTTP {e.code}).')
    except Exception as e:  # noqa: BLE001
        raise AuthError(403, f'Không xác thực được: {e}')
    role = rows[0].get('role') if rows else None
    print(f'AUTH: rows={len(rows)} role={role}')
    if not rows:
        raise AuthError(401, 'Token không hợp lệ (không xác định được tài khoản).')
    if role != 'admin':
        raise AuthError(403, f'Tài khoản không phải admin (role={role}).')


def _authorize(event):
    """Bật auth khi có SUPABASE_URL + ANON_KEY. Để Supabase validate token."""
    if not (SUPABASE_URL and SUPABASE_ANON_KEY):
        print('WARN: SUPABASE_URL/ANON_KEY chưa set — endpoint đang PUBLIC.')
        return
    raw = _raw_auth_header(event)
    token = _bearer_token(event)               # 401 nếu thiếu
    print(f'AUTH: header_present={bool(raw)} alg={_token_claim(token, 0, "alg", "?")}')
    _require_admin_via_supabase(token)


def handler(event, context):
    method = _method(event)
    path = _path(event)

    if method == 'OPTIONS':
        return _resp(200, {'ok': True})

    try:
        _authorize(event)
    except AuthError as e:
        print(f'AUTH DENY {e.status}: {e.msg}')
        return _resp(e.status, {'message': e.msg})

    try:
        # ── List file trong bucket ───────────────────────────────────────────
        if method == 'GET' and path.endswith('/ambient/files'):
            files = []
            paginator = s3.get_paginator('list_objects_v2')
            for page in paginator.paginate(Bucket=BUCKET, Prefix=PREFIX):
                for obj in page.get('Contents', []):
                    key = obj['Key']
                    if key.endswith('/'):
                        continue  # bỏ "thư mục"
                    if not key.lower().endswith(AUDIO_EXT):
                        continue  # chỉ file audio
                    files.append({
                        'name': key[len(PREFIX):] if PREFIX and key.startswith(PREFIX) else key,
                        'url': _public_url(key),
                        'size': obj.get('Size', 0),
                        'lastModified': obj['LastModified'].isoformat() if obj.get('LastModified') else '',
                    })
            files.sort(key=lambda f: f['lastModified'], reverse=True)
            return _resp(200, {'files': files})

        # ── Xin presigned PUT URL ────────────────────────────────────────────
        if method == 'POST' and path.endswith('/ambient/upload-url'):
            body = json.loads(event.get('body') or '{}')
            filename = _sanitize(body.get('filename'))
            content_type = body.get('contentType') or 'audio/mpeg'
            key = f'{PREFIX}{filename}'
            upload_url = s3.generate_presigned_url(
                'put_object',
                Params={'Bucket': BUCKET, 'Key': key, 'ContentType': content_type},
                ExpiresIn=300,  # 5 phút
            )
            return _resp(200, {'uploadUrl': upload_url, 'publicUrl': _public_url(key), 'key': key})

        return _resp(404, {'message': f'Không khớp route: {method} {path}'})

    except Exception as e:  # noqa: BLE001 — trả lỗi gọn cho client
        return _resp(500, {'message': str(e)})
