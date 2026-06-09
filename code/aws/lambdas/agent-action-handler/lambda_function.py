import json
import os
from supabase import create_client

supabase = create_client(
    os.environ['SUPABASE_URL'],
    os.environ['SUPABASE_SERVICE_ROLE_KEY'],
)


def handler(event, context):
    api_path = event['apiPath']
    http_method = event['httpMethod']
    parameters = {p['name']: p['value'] for p in event.get('parameters', [])}
    user_id = event.get('sessionAttributes', {}).get('userId', '')

    if api_path == '/create-task' and http_method == 'POST':
        return create_task(user_id, parameters)
    elif api_path == '/update-task' and http_method == 'PUT':
        return update_task(user_id, parameters)
    elif api_path == '/delete-task' and http_method == 'DELETE':
        return delete_task(user_id, parameters)
    return action_response(400, 'Unknown action', api_path)


def create_task(user_id, params):
    data = {
        'user_id': user_id, 'title': params['title'],
        'description': params.get('description', ''),
        'status': 'pending', 'priority': int(params.get('priority', 0)),
        'due_date': params.get('dueDate'),
    }
    supabase.table('tasks').insert(data).execute()
    return action_response(200, f"Task created: {params['title']}")


def update_task(user_id, params):
    task_id = params.get('taskId')
    task = supabase.table('tasks').select('*').eq('id', task_id).eq('user_id', user_id).execute()
    if not task.data:
        return action_response(404, 'Task not found or not owned by user')
    updates = {k: v for k, v in params.items() if k != 'taskId'}
    supabase.table('tasks').update(updates).eq('id', task_id).execute()
    return action_response(200, 'Task updated')


def delete_task(user_id, params):
    task_id = params.get('taskId')
    supabase.table('tasks').delete().eq('id', task_id).eq('user_id', user_id).execute()
    return action_response(200, 'Task deleted')


def action_response(code, message, api_path='/create-task'):
    return {
        'messageVersion': '1.0',
        'response': {
            'actionGroup': 'todo-manager-api',
            'apiPath': api_path,
            'httpMethod': 'POST',
            'httpStatusCode': code,
            'responseBody': {
                'application/json': {
                    'body': json.dumps({'message': message, 'status': 'success' if code == 200 else 'error'}),
                }
            },
        },
    }
