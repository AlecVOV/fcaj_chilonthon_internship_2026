"""
agent-bff — API Gateway (HTTP API) -> Lambda BFF -> Bedrock InvokeAgent.

XÁC THỰC (in-Lambda, giống ambient-audio-manager):
  access_token của Supabase project này ký ES256 -> JWT authorizer native của API
  Gateway HTTP API (chỉ RS256) KHÔNG verify được. Nên tự xác thực TRONG lambda:
    Bearer token -> decode sub -> GET {SUPABASE_URL}/rest/v1/users?id=eq.{sub}
    kèm token đó (PostgREST verify token bằng khóa project + RLS trả dòng của caller).
  user_id = sub ĐÃ xác thực -> nhét vào sessionState.sessionAttributes.userId.
  Model KHÔNG BAO GIỜ điền userId (không có trong OpenAPI action group) -> chống
  confused-deputy: user A không thể nhờ agent thao tác cho user B.

CHỐNG SESSION HIJACK: sessionId LUÔN được namespace theo user_id
  (session_id = "{user_id}::{client_sid}") -> client không thể đọc/ghi hội thoại
  hay session-state của user khác.

CHỐNG DoS/cost: cap độ dài inputText (MAX_INPUT). Nên thêm API Gateway throttling
  + WAF rate-based ở tầng hạ tầng (xem aws/bedrock/DEPLOY-cmd.md).

Env: BEDROCK_AGENT_ID, BEDROCK_AGENT_ALIAS_ID, SUPABASE_URL, SUPABASE_ANON_KEY,
     ALLOWED_ORIGINS (CSV domain, optional — mặc định '*').
"""

import base64
import json
import os
import re
import urllib.error
import urllib.request
import uuid
import boto3

REGION = os.environ.get('AWS_REGION', 'ap-southeast-1')
AGENT_ID = os.environ.get('BEDROCK_AGENT_ID', '')
AGENT_ALIAS_ID = os.environ.get('BEDROCK_AGENT_ALIAS_ID', '')
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY', '')
ALLOWED_ORIGINS = [o.strip() for o in os.environ.get('ALLOWED_ORIGINS', '').split(',') if o.strip()]
MAX_INPUT = 4000

bedrock = boto3.client('bedrock-agent-runtime', region_name=REGION)


class AuthError(Exception):
    def __init__(self, status, msg):
        super().__init__(msg)
        self.status = status
        self.msg = msg


def _header(event, name):
    for k, v in (event.get('headers') or {}).items():
        if k.lower() == name:
            return v or ''
    return ''


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
    """Để Supabase validate token (mọi thuật toán) + RLS. Trả user_id đã xác thực."""
    if not (SUPABASE_URL and SUPABASE_ANON_KEY):
        raise AuthError(500, 'Auth backend chưa cấu hình (SUPABASE_URL/ANON_KEY).')
    auth = _header(event, 'authorization')
    if not auth.lower().startswith('bearer '):
        raise AuthError(401, 'Thiếu Authorization: Bearer token.')
    token = auth[7:].strip()
    sub = _sub(token)
    try:
        uuid.UUID(str(sub))  # sub phải là UUID trước khi ghép vào URL PostgREST (defense-in-depth)
    except (ValueError, TypeError):
        raise AuthError(401, 'Token không hợp lệ (sub sai).')
    url = f'{SUPABASE_URL}/rest/v1/users?id=eq.{sub}&select=id'
    req = urllib.request.Request(url, headers={
        'apikey': SUPABASE_ANON_KEY, 'Authorization': f'Bearer {token}', 'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            rows = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            raise AuthError(401, 'Token không hợp lệ hoặc đã hết hạn.')
        raise AuthError(403, f'Xác thực thất bại (HTTP {e.code}).')
    except Exception as e:  # noqa: BLE001
        raise AuthError(403, f'Xác thực thất bại: {e}')
    if not rows:
        raise AuthError(401, 'Token không gắn với tài khoản hợp lệ.')
    return sub


def handler(event, context):
    if _method(event) == 'OPTIONS':
        return _resp(200, {'ok': True}, event)
    try:
        user_id = _verify_user(event)

        body = json.loads(event.get('body') or '{}')
        input_text = (body.get('inputText') or '').strip()
        if not input_text:
            return _resp(400, {'message': 'inputText là bắt buộc.'}, event)
        if len(input_text) > MAX_INPUT:
            return _resp(400, {'message': f'inputText quá dài (tối đa {MAX_INPUT} ký tự).'}, event)

        # sessionId LUÔN namespace theo user_id — client không đụng được session user khác.
        client_sid = re.sub(r'[^A-Za-z0-9_-]', '', str(body.get('sessionId', 'default')))[:64] or 'default'
        session_id = f'{user_id}::{client_sid}'

        if not (AGENT_ID and AGENT_ALIAS_ID):
            return _resp(503, {'message': 'Bedrock Agent chưa cấu hình (BEDROCK_AGENT_ID/ALIAS_ID).'}, event)

        resp = bedrock.invoke_agent(
            agentId=AGENT_ID,
            agentAliasId=AGENT_ALIAS_ID,
            sessionId=session_id,
            inputText=input_text,
            sessionState={'sessionAttributes': {'userId': user_id}},
        )
        completion = ''
        for evt in resp.get('completion', []):
            if 'chunk' in evt:
                completion += evt['chunk']['bytes'].decode('utf-8')

        return _resp(200, {'sessionId': client_sid, 'responseText': completion}, event)

    except AuthError as e:
        print(f'AUTH DENY {e.status}: {e.msg}')
        return _resp(e.status, {'message': e.msg}, event)
    except Exception as e:  # noqa: BLE001 — không rò rỉ chi tiết ra client
        msg = str(e)
        # Bedrock quota thấp -> throttling rất hay gặp; trả 429 rõ để UI báo "thử lại" thay vì "lỗi".
        if any(k in msg for k in ('ThrottlingException', 'throttlingException', 'ThrottledException',
                                  'TooManyRequests', 'serviceQuotaExceeded', 'ServiceQuotaExceeded')):
            print(f'THROTTLED agent-bff: {msg}')
            return _resp(429, {'message': 'Hệ thống AI đang quá tải (giới hạn tần suất). Vui lòng thử lại sau vài giây.'}, event)
        print(f'ERROR agent-bff: {e}')
        return _resp(500, {'message': 'Lỗi nội bộ, thử lại sau.'}, event)
