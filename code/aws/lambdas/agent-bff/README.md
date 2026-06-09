# Agent BFF — Lambda Function

**Purpose:** Frontend-facing endpoint. Receives user chat messages, validates JWT,
calls AWS Bedrock Agent Runtime, returns formatted response with tasks.

## Input (API Gateway → Lambda)

```json
{
  "body": "{\"sessionId\": \"session-xxx\", \"inputText\": \"Write internship report\"}",
  "requestContext": {
    "authorizer": { "claims": { "sub": "user-uuid" } }
  }
}
```

## Output (Lambda → API Gateway → Frontend)

```json
{
  "statusCode": 200,
  "body": "{\"sessionId\": \"session-xxx\", \"responseText\": \"I've created 2 tasks...\", \"tasks\": [...]}"
}
```

## Deploy

```bash
chmod +x deploy.sh
./deploy.sh agent-bff
```

## Environment Variables

| Key | Value | Source |
|-----|-------|--------|
| `BEDROCK_AGENT_ID` | `XXXXXXXXXX` | Bedrock Console → Agent |
| `BEDROCK_AGENT_ALIAS_ID` | `YYYYYYYYYY` | Bedrock Console → Alias |
