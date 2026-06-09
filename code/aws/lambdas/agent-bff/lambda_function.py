import json
import os
import boto3

bedrock_agent_runtime = boto3.client('bedrock-agent-runtime', region_name=os.environ.get('AWS_REGION', 'ap-southeast-1'))

AGENT_ID = os.environ['BEDROCK_AGENT_ID']
AGENT_ALIAS_ID = os.environ['BEDROCK_AGENT_ALIAS_ID']


def handler(event, context):
    """API Gateway → Lambda BFF → Bedrock Agent → return formatted response."""
    body = json.loads(event['body'])
    user_id = event['requestContext']['authorizer']['claims']['sub']
    session_id = body.get('sessionId', f'session-{user_id}')
    input_text = body['inputText']

    # Call Bedrock Agent
    response = bedrock_agent_runtime.invoke_agent(
        agentId=AGENT_ID,
        agentAliasId=AGENT_ALIAS_ID,
        sessionId=session_id,
        inputText=input_text,
        sessionState={'sessionAttributes': {'userId': user_id}},
    )

    # Stream and collect completion
    completion = ''
    for evt in response.get('completion', []):
        if 'chunk' in evt:
            completion += evt['chunk']['bytes'].decode('utf-8')

    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({
            'sessionId': session_id,
            'responseText': completion,
        }),
    }
