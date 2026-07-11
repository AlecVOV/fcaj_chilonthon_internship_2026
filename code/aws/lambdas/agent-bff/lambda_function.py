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

NGÀY HIỆN TẠI: Bedrock Agent không tự biết "hôm nay" là ngày nào -> mỗi lần gọi đều tính
  lại datetime.now() theo giờ VN (UTC+7 cố định) và gửi currentDate (YYYY-MM-DD) +
  currentDayOfWeek. GỬI QUA `promptSessionAttributes`, KHÔNG PHẢI `sessionAttributes` --
  2 field khác nhau: sessionAttributes chỉ tới được Lambda action group (event), model
  KHÔNG thấy; promptSessionAttributes mới được chèn vào prompt gửi cho model. Nhầm field
  này -> model không thấy ngày, tự bịa năm (đã dính bug này 2026-07-11, đã sửa).
  agent-instructions.txt dạy agent dùng 2 giá trị này để suy luận ngày user nói thiếu
  năm/tương đối ("15/07", "thứ 6 tới") thay vì đoán mò.

CHỐNG SESSION HIJACK: sessionId LUÔN được namespace theo user_id
  (session_id = "{user_id}::{client_sid}") -> client không thể đọc/ghi hội thoại
  hay session-state của user khác.

CHỐNG DoS/cost: cap độ dài inputText (MAX_INPUT) + AGENT_DAILY_LIMIT lượt/user/ngày.
  API Gateway throttling/WAF KHÔNG làm (scope demo bootcamp, không public commercial cho
  nhiều user) — cân nhắc lại khi scale app lên >100 user thật, xem aws/bedrock/DEPLOY-cmd.md.

GIỚI HẠN LƯỢT/NGÀY: trước khi gọi Bedrock, gọi RPC bump_agent_usage(AGENT_DAILY_LIMIT)
  (Supabase, SECURITY DEFINER) — vượt hạn -> 429. Fail-open nếu RPC lỗi (không chặn nhầm user).

Env: BEDROCK_AGENT_ID, BEDROCK_AGENT_ALIAS_ID, SUPABASE_URL, SUPABASE_ANON_KEY,
     ALLOWED_ORIGINS (CSV domain, optional — mặc định '*'),
     AGENT_DAILY_LIMIT (số lượt AI/user/ngày, mặc định 20).
"""

import base64
import json
import os
import re
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone
import boto3

# Gio VN = UTC+7 co dinh (khong co DST) -- dung offset thang, KHONG dung zoneinfo/'Asia/Ho_Chi_Minh'
# vi Lambda runtime co the thieu goi tzdata he thong -> ZoneInfoNotFoundError luc chay.
APP_TZ = timezone(timedelta(hours=7))

REGION = os.environ.get('AWS_REGION', 'ap-southeast-1')
AGENT_ID = os.environ.get('BEDROCK_AGENT_ID', '')
AGENT_ALIAS_ID = os.environ.get('BEDROCK_AGENT_ALIAS_ID', '')
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY', '')
ALLOWED_ORIGINS = [o.strip() for o in os.environ.get('ALLOWED_ORIGINS', '').split(',') if o.strip()]
MAX_INPUT = 4000
AGENT_DAILY_LIMIT = int(os.environ.get('AGENT_DAILY_LIMIT', '10')) #Sửa lại tăng số lần để test lambda

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


def _bump_usage(token):
    """Tăng đếm lượt/ngày qua RPC SECURITY DEFINER. Trả count sau tăng (>0) hoặc -1 nếu vượt hạn.
    Fail-open (trả 0) nếu RPC lỗi — không chặn nhầm user vì sự cố tạm thời."""
    url = f'{SUPABASE_URL}/rest/v1/rpc/bump_agent_usage'
    data = json.dumps({'p_limit': AGENT_DAILY_LIMIT}).encode()
    req = urllib.request.Request(url, data=data, method='POST', headers={
        'apikey': SUPABASE_ANON_KEY, 'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json', 'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return int(json.loads(r.read().decode()))
    except Exception as e:  # noqa: BLE001
        print(f'WARN bump_agent_usage failed (fail-open): {e}')
        return 0


def handler(event, context):
    if _method(event) == 'OPTIONS':
        return _resp(200, {'ok': True}, event)
    try:
        user_id = _verify_user(event)
        token = _header(event, 'authorization')[7:].strip()  # đã validate 'Bearer ' trong _verify_user

        body = json.loads(event.get('body') or '{}')
        input_text = (body.get('inputText') or '').strip()
        if not input_text:
            return _resp(400, {'message': 'inputText là bắt buộc.'}, event)
        if len(input_text) > MAX_INPUT:
            return _resp(400, {'message': f'inputText quá dài (tối đa {MAX_INPUT} ký tự).'}, event)

        # Giới hạn lượt AI/ngày (chống lạm dụng + tiết kiệm cost Bedrock).
        if _bump_usage(token) < 0:
            return _resp(429, {'message': f'Bạn đã dùng hết {AGENT_DAILY_LIMIT} lượt trợ lý AI hôm nay. Vui lòng quay lại vào ngày mai.'}, event)

        # sessionId LUÔN namespace theo user_id — client không đụng được session user khác.
        client_sid = re.sub(r'[^A-Za-z0-9_-]', '', str(body.get('sessionId', 'default')))[:64] or 'default'
        session_id = f'{user_id}::{client_sid}'

        if not (AGENT_ID and AGENT_ALIAS_ID):
            return _resp(503, {'message': 'Bedrock Agent chưa cấu hình (BEDROCK_AGENT_ID/ALIAS_ID).'}, event)

        # Bedrock Agent khong tu biet "hom nay" -- phai tu gui vao promptSessionAttributes
        # (KHONG PHAI sessionAttributes -- field do model khong doc duoc, chi Lambda doc
        # duoc qua event) moi lan goi (tinh lai theo gio VN) de agent suy luan dung
        # ngay/thang thieu nam.
        now_vn = datetime.now(APP_TZ)
        resp = bedrock.invoke_agent(
            agentId=AGENT_ID,
            agentAliasId=AGENT_ALIAS_ID,
            sessionId=session_id,
            inputText=input_text,
            sessionState={
                'sessionAttributes': {'userId': user_id},
                'promptSessionAttributes': {
                    'currentDate': now_vn.strftime('%Y-%m-%d'),
                    'currentDayOfWeek': now_vn.strftime('%A'),
                },
            },
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
