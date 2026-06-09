# Bedrock Agent — Setup

## What this folder contains

`action-group-openapi.yaml` — OpenAPI schema for the Bedrock Agent Action Group.
Defines the 3 operations the agent can invoke: create-task, update-task, delete-task.

## Setup in AWS Console

### 1. Create Agent
1. Bedrock Console → Agents → Create Agent
2. Agent Name: `task-manager-agent`
3. Foundation Model: `Claude 3 Haiku` (fast, cost-effective)
4. Agent Instructions:
```
You are a task management assistant. When a user describes what they need to do:

1. EVALUATE if the description has enough detail (title, due date, priority)
2. IF detailed enough → CALL the create-task action and confirm
3. IF not detailed → ASK follow-up questions to gather more context
4. For complex requests → suggest breaking into multiple tasks
5. ALWAYS confirm what was done with the user
```

### 2. Create Action Group
1. Action Group Name: `todo-manager-api`
2. OpenAPI Schema: Upload `action-group-openapi.yaml`
3. Lambda Handler: `agent-action-handler`

### 3. Configure Guardrails (Optional)
1. Enable PII redaction
2. Enable prompt attack prevention
3. Set max response length

### 4. Create Alias
1. Alias Name: `prod`
2. Associate with latest agent version

### 5. Lambda Resource Policy
```bash
aws lambda add-permission \
  --function-name agent-action-handler \
  --statement-id bedrock-agent-invoke \
  --action lambda:InvokeFunction \
  --principal bedrock.amazonaws.com \
  --source-arn "arn:aws:bedrock:${REGION}:${ACCOUNT}:agent/*" \
  --region ap-southeast-1
```

### 6. Get Agent IDs
After creation, note:
- **Agent ID:** `XXXXXXXXXX`
- **Agent Alias ID:** `YYYYYYYYYY`

Set these as environment variables on the `agent-bff` Lambda.
