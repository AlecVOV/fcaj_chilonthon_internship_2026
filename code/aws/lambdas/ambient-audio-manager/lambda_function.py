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
  SUPABASE_JWT_SECRET (tùy chọn)  BẬT auth: verify Supabase JWT (HS256) ngay trong Lambda.
                                  KHÔNG set = endpoint public (như cũ).
  SUPABASE_URL        (tùy chọn)  + ANON_KEY để check thêm role admin (RLS đọc chính user đó).
  SUPABASE_ANON_KEY   (tùy chọn)

Xác thực (cách 2 — verify token trong Lambda): nếu có SUPABASE_JWT_SECRET, Lambda tự
verify chữ ký HS256 + hạn (exp) + aud của access_token Supabase mà frontend gửi qua
header Authorization: Bearer. Nếu thêm SUPABASE_URL + ANON_KEY, Lambda gọi Supabase REST
(bằng chính token của user, RLS-scoped) để chắc chắn user có role='admin'. Không set secret
thì bỏ qua (public) để không phá vỡ deploy đang chạy.
(Cách 1 — JWT authorizer ở API Gateway — xem DEPLOY-cmd.md, không dùng vì Supabase HS256.)
"""

import base64
import hashlib
import hmac
import json
import os
import re
import time
import urllib.request
import boto3
from urllib.parse import quote
from botocore.config import Config

REGION = os.environ.get('AWS_REGION', 'ap-southeast-1')
BUCKET = os.environ.get('AMBIENT_S3_BUCKET', 'focus-mode-ambient-audio')
PREFIX = os.environ.get('AMBIENT_S3_PREFIX', '')

# ── Auth (verify Supabase JWT ngay trong Lambda — cách 2) ────────────────────
SUPABASE_JWT_SECRET = os.environ.get('SUPABASE_JWT_SECRET', '')  # có = bật auth
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')                # + để check admin
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


def _b64url_decode(seg):
    seg += '=' * (-len(seg) % 4)               # pad lại cho đủ bội số 4
    return base64.urlsafe_b64decode(seg.encode())


def _bearer_token(event):
    headers = event.get('headers') or {}
    auth = ''
    for k, v in headers.items():               # key có thể hoa/thường tùy payload
        if k.lower() == 'authorization':
            auth = v or ''
            break
    if not auth.lower().startswith('bearer '):
        raise AuthError(401, 'Thiếu Authorization: Bearer token.')
    return auth[7:].strip()


def _verify_jwt(token):
    """Verify HS256 Supabase access_token bằng stdlib. Trả claims nếu hợp lệ."""
    parts = token.split('.')
    if len(parts) != 3:
        raise AuthError(401, 'JWT sai định dạng.')
    header_b64, payload_b64, sig_b64 = parts
    expected = hmac.new(SUPABASE_JWT_SECRET.encode(),
                        f'{header_b64}.{payload_b64}'.encode(), hashlib.sha256).digest()
    try:
        actual = _b64url_decode(sig_b64)
    except Exception:
        raise AuthError(401, 'JWT chữ ký lỗi định dạng.')
    if not hmac.compare_digest(expected, actual):
        raise AuthError(401, 'JWT chữ ký không hợp lệ.')
    try:
        claims = json.loads(_b64url_decode(payload_b64))
    except Exception:
        raise AuthError(401, 'JWT payload lỗi.')
    if claims.get('exp') and int(time.time()) >= int(claims['exp']):
        raise AuthError(401, 'Token đã hết hạn — đăng nhập lại.')
    aud = claims.get('aud')
    auds = aud if isinstance(aud, list) else [aud]
    if aud and 'authenticated' not in auds:
        raise AuthError(403, 'aud không hợp lệ.')
    return claims


def _require_admin(token, sub):
    """Hỏi Supabase REST (bằng token của chính user, RLS-scoped) xem có role='admin'."""
    url = f'{SUPABASE_URL}/rest/v1/users?id=eq.{sub}&select=role'
    req = urllib.request.Request(url, headers={
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': f'Bearer {token}',
        'Accept': 'application/json',
    })
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            rows = json.loads(resp.read().decode())
    except Exception as e:  # noqa: BLE001
        raise AuthError(403, f'Không kiểm tra được quyền admin: {e}')
    role = rows[0].get('role') if rows else None
    if role != 'admin':
        raise AuthError(403, 'Chỉ admin được dùng chức năng này.')


def _authorize(event):
    """Bật khi có SUPABASE_JWT_SECRET; thêm check admin nếu có URL + ANON_KEY."""
    if not SUPABASE_JWT_SECRET:
        print('WARN: SUPABASE_JWT_SECRET chưa set — endpoint đang PUBLIC (không verify).')
        return
    token = _bearer_token(event)
    claims = _verify_jwt(token)
    if SUPABASE_URL and SUPABASE_ANON_KEY:
        _require_admin(token, claims.get('sub'))


def handler(event, context):
    method = _method(event)
    path = _path(event)

    if method == 'OPTIONS':
        return _resp(200, {'ok': True})

    try:
        _authorize(event)
    except AuthError as e:
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
