"""
agent-action-handler — Bedrock Agent Action Group -> CRUD task trong Supabase.

BẢO MẬT (chống prompt injection / confused deputy):
- user_id CHỈ lấy từ event['sessionAttributes']['userId'] (do agent-bff set SAU khi
  verify token). Model KHÔNG BAO GIỜ điền được userId (không có trong OpenAPI schema)
  -> user A không thể nhờ agent thao tác dữ liệu của user B.
- FAIL-CLOSED: thiếu / userId không phải UUID -> 403, KHÔNG đụng DB.
- WHITELIST field khi ghi (create/update) -> model/schema drift hay call bị inject
  thêm key (vd user_id, role, id) KHÔNG ghi được cột ngoài ý muốn (mass-assignment).
- Giới hạn độ dài title/description; ép kiểu + validate priority (0-3) và status (enum).
- Mọi query BẮT BUỘC .eq('user_id', user_id) (dùng SERVICE_ROLE_KEY nên RLS bị bypass;
  ownership do code enforce). service_role NÊN để trong Secrets Manager — xem README.

Input: Bedrock đặt query/path params ở event['parameters'] NHƯNG requestBody ở
event['requestBody']['content']['application/json']['properties'] (list {name,value})
-> _params() gộp cả hai (bug cũ chỉ đọc 'parameters' làm mất title/description).
"""

import json
import os
import uuid
from datetime import datetime
from supabase import create_client

supabase = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])

# Field ghi được từ model. dueDate (camelCase, từ OpenAPI) xử lý riêng -> cột due_date.
ALLOWED_WRITE = {'title', 'description', 'status', 'priority'}
VALID_STATUS = {'pending', 'in_progress', 'completed', 'cancelled'}
MAX_TITLE = 200
MAX_DESC = 2000


class BadInput(Exception):
    """Input sai (vd dueDate lỗi định dạng) -> trả 400 thay vì 500."""


def _params(event):
    """Gộp parameters (query/path) + requestBody properties (JSON body)."""
    out = {p['name']: p.get('value') for p in event.get('parameters', [])}
    props = (event.get('requestBody', {}) or {}).get('content', {}) \
        .get('application/json', {}).get('properties', [])
    for p in props:
        out[p['name']] = p.get('value')
    return out


def _valid_uuid(v):
    try:
        uuid.UUID(str(v))
        return True
    except Exception:
        return False


def _clean_writes(params):
    """Chỉ giữ field cho phép + ép kiểu/validate. Bỏ mọi field lạ (mass-assignment guard)."""
    w = {k: params[k] for k in ALLOWED_WRITE if k in params and params[k] is not None}
    if 'title' in w:
        w['title'] = str(w['title']).strip()[:MAX_TITLE]
    if 'description' in w:
        w['description'] = str(w['description'])[:MAX_DESC]
    if 'priority' in w:
        try:
            w['priority'] = max(0, min(3, int(w['priority'])))
        except (TypeError, ValueError):
            w.pop('priority')
    if 'status' in w and w['status'] not in VALID_STATUS:
        w.pop('status')
    # dueDate (camelCase từ schema) -> due_date (cột DB DATE). Validate YYYY-MM-DD thật,
    # nếu không Postgres sẽ ném lỗi -> 500 khó hiểu. Sai định dạng -> BadInput (400).
    dd = params.get('dueDate')
    if dd not in (None, ''):
        try:
            datetime.strptime(str(dd), '%Y-%m-%d')
        except ValueError:
            raise BadInput('dueDate phải dạng YYYY-MM-DD.')
        w['due_date'] = str(dd)
    return w


def handler(event, context):
    api_path = event.get('apiPath', '')
    http_method = event.get('httpMethod', '')
    user_id = (event.get('sessionAttributes') or {}).get('userId', '')

    # Fail-closed: identity phải hợp lệ, nếu không TUYỆT ĐỐI không đụng DB.
    if not user_id or not _valid_uuid(user_id):
        return _response(event, 403, 'Thiếu hoặc sai user identity.')

    params = _params(event)
    try:
        if api_path == '/create-task' and http_method == 'POST':
            return _create(event, user_id, params)
        if api_path == '/update-task' and http_method == 'PUT':
            return _update(event, user_id, params)
        if api_path == '/delete-task' and http_method == 'DELETE':
            return _delete(event, user_id, params)
        return _response(event, 400, f'Unknown action {http_method} {api_path}')
    except BadInput as bi:
        return _response(event, 400, str(bi))
    except Exception as e:  # noqa: BLE001
        print(f'ERROR action-handler: {e}')
        return _response(event, 500, 'Lỗi nội bộ khi thao tác task.')


def _create(event, user_id, params):
    w = _clean_writes(params)
    title = w.get('title', '')
    if not title:
        return _response(event, 400, 'Task title là bắt buộc.')
    data = {
        'user_id': user_id,
        'title': title,
        'status': 'pending',
        'description': w.get('description', ''),
        'priority': w.get('priority', 0),
        'due_date': w.get('due_date'),
    }
    supabase.table('tasks').insert(data).execute()
    return _response(event, 200, f'Đã tạo task: {title}')


def _update(event, user_id, params):
    task_id = params.get('taskId')
    if not _valid_uuid(task_id):
        return _response(event, 400, 'Cần taskId hợp lệ.')
    owned = supabase.table('tasks').select('id').eq('id', task_id).eq('user_id', user_id).execute()
    if not owned.data:
        return _response(event, 404, 'Không tìm thấy task hoặc task không thuộc bạn.')
    updates = _clean_writes(params)
    if not updates:
        return _response(event, 400, 'Không có field hợp lệ để cập nhật.')
    supabase.table('tasks').update(updates).eq('id', task_id).eq('user_id', user_id).execute()
    return _response(event, 200, 'Đã cập nhật task.')


def _delete(event, user_id, params):
    task_id = params.get('taskId')
    if not _valid_uuid(task_id):
        return _response(event, 400, 'Cần taskId hợp lệ.')
    res = supabase.table('tasks').delete().eq('id', task_id).eq('user_id', user_id).execute()
    if not res.data:
        return _response(event, 404, 'Không tìm thấy task hoặc task không thuộc bạn.')
    return _response(event, 200, 'Đã xóa task.')


def _response(event, code, message):
    """Trả đúng apiPath/httpMethod/actionGroup của request (không hardcode create-task)."""
    return {
        'messageVersion': '1.0',
        'response': {
            'actionGroup': event.get('actionGroup', 'todo-manager-api'),
            'apiPath': event.get('apiPath', '/create-task'),
            'httpMethod': event.get('httpMethod', 'POST'),
            'httpStatusCode': code,
            'responseBody': {'application/json': {'body': json.dumps(
                {'message': message, 'status': 'success' if code == 200 else 'error'})}},
        },
    }
