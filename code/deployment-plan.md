# Focus Mode App — AWS Bedrock Agent + Supabase Deployment Plan

**Date:** June 8, 2026  
**Current State:** POC Demo (Nuxt 4 frontend, mock data, no cloud services)  
**Target State:** Full cloud-native architecture — Supabase, AWS Bedrock Agents, Lambda, SES  
**Reference Architecture:** `Internship_Architecture.drawio`

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                               │
│  ┌──────────────┐    ┌──────────────────────────────────────┐   │
│  │ Cognito /     │    │ AWS Amplify (Nuxt 4 Static Site)     │   │
│  │ Supabase Auth │    │  ┌─────────┐ ┌────────┐ ┌────────┐  │   │
│  │ (JWT issuer)  │    │  │ Agent   │ │ Focus  │ │ Tasks  │  │   │
│  └──────┬───────┘    │  │ Chat    │ │ Timer  │ │ Table  │  │   │
│         │            │  └─────────┘ └────────┘ └────────┘  │   │
│         │            └──────────────────────────────────────┘   │
│         │                          │                             │
│         ▼                          ▼                             │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                  AWS API Gateway (JWT Authorizer)            │ │
│  │  /agent/chat   /emotion/detect   /report   /rag/recommend   │ │
│  │  /admin/vectorize                                           │ │
│  └──────────────────────────┬──────────────────────────────────┘ │
└─────────────────────────────┼────────────────────────────────────┘
                              │
┌─────────────────────────────┼────────────────────────────────────┐
│                        AWS CLOUD                                  │
│                              │                                    │
│  ┌───────────────────────────▼────────────────────────────────┐  │
│  │               AWS Lambda — Agent BFF (Backend For Frontend) │  │
│  │  • Validates JWT, maps user → sessionId                     │  │
│  │  • Calls Bedrock InvokeAgent(agentId, aliasId, sessionId,   │  │
│  │    inputText)                                                │  │
│  │  • Returns: responseText, tasks[], followUpQuestions[]      │  │
│  └───────────────────────────┬────────────────────────────────┘  │
│                              │                                    │
│  ┌───────────────────────────▼────────────────────────────────┐  │
│  │              Amazon Bedrock Agent Runtime                    │  │
│  │                                                              │  │
│  │  ┌─────────────────┐   ┌──────────────────────────────┐    │  │
│  │  │ Bedrock          │   │ Task Manager Agent            │    │  │
│  │  │ Guardrails        │   │ • Instructions + prompts      │    │  │
│  │  │ (PII / safety)   │   │ • Foundation Model (Claude/   │    │  │
│  │  └─────────────────┘   │   Nova)                        │    │  │
│  │                        └──────────────┬───────────────┘    │  │
│  │                                       │                     │  │
│  │  ┌────────────────────────────────────▼──────────────────┐ │  │
│  │  │          Agent Orchestration Loop                      │ │  │
│  │  │   Understand → Plan → Elicit → Act                     │ │  │
│  │  │                                                        │ │  │
│  │  │  ┌──────────────────────────────────────────────────┐ │ │  │
│  │  │  │  Action Group: To-Do Manager API                  │ │ │  │
│  │  │  │  OpenAPI Schema defines:                          │ │ │  │
│  │  │  │  POST /create-task   POST /update-task            │ │ │  │
│  │  │  │  DELETE /delete-task                              │ │ │  │
│  │  │  └──────────────────────┬───────────────────────────┘ │ │  │
│  │  └─────────────────────────┼─────────────────────────────┘ │  │
│  └────────────────────────────┼───────────────────────────────┘  │
│                                │                                  │
│  ┌─────────────────────────────▼──────────────────────────────┐  │
│  │      AWS Lambda — Action Handler (agent-action-handler)    │  │
│  │  • Receives Bedrock Agent invocation with apiPath,         │  │
│  │    httpMethod, parameters, sessionAttributes               │  │
│  │  • Business logic: validate, create/update/delete task     │  │
│  │  • Idempotency: retry-safe writes                          │  │
│  │  • Returns observation back to Agent Orchestration Loop     │  │
│  └─────────────────────────────┬──────────────────────────────┘  │
│                                │                                  │
│  ┌─────────────────────────────▼──────────────────────────────┐  │
│  │              AWS Secrets Manager                            │  │
│  │  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY                    │  │
│  └─────────────────────────────┬──────────────────────────────┘  │
│                                │                                  │
│  ┌─────────────────────────────▼──────────────────────────────┐  │
│  │          Supabase PostgreSQL (External Database)            │  │
│  │  tasks, focus_sessions, media_library, daily_worklogs       │  │
│  │  pgvector extension (RAG embeddings)                        │  │
│  │  Row Level Security (RLS) enforced                          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────────────┐ ┌────────────────────────────┐ │
│  │ Amazon S3 (reports + media)  │ │ Amazon SES (daily email)   │ │
│  └──────────────────────────────┘ └────────────────────────────┘ │
│                                                                   │
│  ┌──────────────────────────────┐ ┌────────────────────────────┐ │
│  │ CloudWatch (logs + metrics)  │ │ X-Ray (distributed tracing) │ │
│  └──────────────────────────────┘ └────────────────────────────┘ │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  Amazon EventBridge (cron — nightly report generation)      │ │
│  └──────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘
```

---

## Part 1: Supabase Cloud Setup

### 1.1 Create Supabase Project

| Step | Action |
|------|--------|
| 1 | Go to [supabase.com](https://supabase.com) → New Project |
| 2 | Name: `focus-mode` |
| 3 | Region: `ap-southeast-1` (Singapore — closest to Vietnam) |
| 4 | Database password: generate strong password, save it |
| 5 | Pricing: Free Tier (500 MB, 2 projects) |

### 1.2 Run Database Schema

1. Open **SQL Editor** in Supabase Dashboard
2. Paste and run `docs/database/schema.sql`
3. Creates tables: `users`, `tasks`, `focus_sessions`, `daily_worklogs`, `media_library`
4. Enables extensions: `uuid-ossp`, `pgcrypto`, `vector` (pgvector)

### 1.3 Enable Row Level Security (RLS)

```sql
-- Tasks: users CRUD their own; Action Handler Lambda uses service_role
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users CRUD own tasks" ON public.tasks
  FOR ALL USING (auth.uid() = user_id);

-- Focus Sessions
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users CRUD own sessions" ON public.focus_sessions
  FOR ALL USING (auth.uid() = user_id);

-- Media Library: read all, admin modify
ALTER TABLE public.media_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read media" ON public.media_library
  FOR SELECT USING (true);
CREATE POLICY "Admins manage media" ON public.media_library
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Daily Worklogs: users read own
ALTER TABLE public.daily_worklogs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own worklogs" ON public.daily_worklogs
  FOR SELECT USING (auth.uid() = user_id);
```

### 1.4 User Approval Workflow Tables

Add these tables for the admin-approval user registration flow:

```sql
-- 1.4a User Requests (waitlist for admin approval)
CREATE TABLE IF NOT EXISTS public.user_requests (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           TEXT NOT NULL UNIQUE,
    full_name       TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at     TIMESTAMPTZ,
    approved_by     UUID REFERENCES public.profiles(id)
);

-- 1.4b Profiles table (add requires_password_change flag)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS requires_password_change BOOLEAN DEFAULT false;

-- 1.4c Auto-trigger: when user_request is approved, create auth user via Supabase Admin API
-- (Executed by Edge Function, not direct SQL trigger)
```

### 1.5 Supabase Edge Function: Approve User

Create a Supabase Edge Function `approve-user` with `service_role` access:

```typescript
// supabase/functions/approve-user/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { requestId } = await req.json()
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // 1. Get request details
  const { data: reqData } = await supabaseAdmin
    .from('user_requests').select('*').eq('id', requestId).single()

  // 2. Invite user (Supabase sends invite email automatically)
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(reqData.email, {
    data: { full_name: reqData.full_name }
  })
  if (error) throw error

  // 3. Update request status
  await supabaseAdmin.from('user_requests')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', requestId)

  // 4. Set requires_password_change in profiles
  await supabaseAdmin.from('profiles')
    .update({ requires_password_change: true })
    .eq('id', data.user.id)

  return new Response(JSON.stringify({ success: true }), { status: 200 })
})
```

### 1.6 Row Level Security (RLS)

Same as before, plus:
```sql
-- User Requests: admin read/write, users insert own
ALTER TABLE public.user_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert requests" ON public.user_requests
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins read/write requests" ON public.user_requests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Profiles: users read/update own, admin read all
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins read all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

### 1.5 Get API Keys

From Supabase Dashboard → Settings → API:
- **Project URL:** `https://xxxxxxxxxxxx.supabase.co`
- **anon public key:** `eyJhbGciOi...` (for client)
- **service_role key:** `eyJhbGciOi...` (for Lambda/Bedrock — keep secret)

---

## Part 2: AWS Services

### 2.1 AWS Cognito / Identity Provider

| Config | Value |
|--------|-------|
| User Pool | For app user authentication |
| JWT Issuer | Used by API Gateway authorizer |
| Alternative | Use Supabase Auth JWT directly (simpler for MVP) |

### 2.2 AWS WAF (Optional)

Basic edge protection for API Gateway — SQL injection, rate limiting. Not required for MVP but recommended.

### 2.3 AWS API Gateway

| Route | Method | Target | Auth |
|-------|--------|--------|------|
| `/agent/chat` | POST | Lambda BFF → Bedrock Agent | JWT |
| `/emotion/detect` | POST | Emotion Detector Lambda | JWT |
| `/report` | POST | Report Generator Lambda | JWT |
| `/rag/recommend` | POST | RAG Recommender Lambda | JWT |
| `/admin/vectorize` | POST | Admin Vectorizer Lambda | JWT + Admin |

**JWT Authorizer Configuration:**
1. API Gateway → Authorizers → Create JWT authorizer
2. Issuer: `https://xxxxxxxxxxxx.supabase.co/auth/v1`
3. Audience: `authenticated`

### 2.4 AWS Secrets Manager

| Secret | Value |
|--------|-------|
| `SUPABASE_URL` | `https://xxxxxxxxxxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOi...` |

The Action Handler Lambda reads these at runtime to connect to Supabase with elevated privileges.

---

## Part 3: AWS Lambda Functions

### 3.1 Lambda 0: Agent BFF (`agent-bff`)

**Purpose:** Frontend-facing endpoint. Receives user chat messages, calls Bedrock Agent, returns formatted response.

| Config | Value |
|--------|-------|
| Runtime | Python 3.12 |
| Memory | 256 MB |
| Timeout | 30 seconds |
| Trigger | API Gateway `POST /agent/chat` |
| Package | `boto3` (AWS SDK — included in Lambda) |
| IAM Role | `bedrock:InvokeAgent` on the Task Manager Agent resource |

**Handler:**
```python
import json
import boto3
import os

bedrock_agent_runtime = boto3.client('bedrock-agent-runtime')

AGENT_ID = os.environ['BEDROCK_AGENT_ID']
AGENT_ALIAS_ID = os.environ['BEDROCK_AGENT_ALIAS_ID']

def handler(event, context):
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
        sessionState={
            'sessionAttributes': {
                'userId': user_id,
            }
        }
    )

    # Stream and collect completion
    completion = ''
    for event in response['completion']:
        if 'chunk' in event:
            completion += event['chunk']['bytes'].decode('utf-8')

    return {
        'statusCode': 200,
        'body': json.dumps({
            'sessionId': session_id,
            'responseText': completion,
            'tasks': extract_tasks_from_response(completion)
        })
    }
```

### 3.2 Lambda 1: Emotion Detector (`focus-emotion-detector`)

Same as before — ONNX model for journal text → emotion label.

| Config | Value |
|--------|-------|
| Memory | 512 MB |
| Timeout | 15 sec |
| Trigger | API Gateway `POST /emotion/detect` |

### 3.3 Lambda 2: Report Generator (`focus-report-generator`)

Same as before — Markdown → S3 + SES email.

| Config | Value |
|--------|-------|
| Memory | 1024 MB |
| Timeout | 60 sec |
| Trigger | API Gateway `POST /report` + EventBridge cron |

### 3.4 Lambda 3: RAG Recommender (`focus-rag-recommender`)

Same as before — pgvector similarity search.

| Config | Value |
|--------|-------|
| Memory | 512 MB |
| Timeout | 10 sec |
| Trigger | API Gateway `POST /rag/recommend` |

### 3.5 Lambda 4: Admin Vectorizer (`focus-admin-vectorize`)

Same as before — all-MiniLM-L6-v2 embedding generation.

| Config | Value |
|--------|-------|
| Memory | 512 MB |
| Timeout | 15 sec |
| Trigger | API Gateway `POST /admin/vectorize` |

---

## Part 4: Amazon Bedrock Agent Configuration

### 4.1 Create Task Manager Agent

| Setting | Value |
|---------|-------|
| Agent Name | `task-manager-agent` |
| Foundation Model | Claude 3 Haiku (or Nova) |
| Agent Instructions | See below |
| Guardrails | PII redaction, prompt attack prevention |

**Agent Instructions (System Prompt):**
```
You are a task management assistant. Your job is to help users create, update,
and manage their to-do tasks.

When a user describes what they need to do:
1. EVALUATE if the description is detailed enough:
   - Task title/description
   - Due date (if mentioned)
   - Priority level
2. IF details are sufficient → CALL the create-task action and return confirmation
3. IF details are insufficient → ASK clarifying follow-up questions
4. ALWAYS confirm with the user what was done
```

### 4.2 Create Action Group

| Setting | Value |
|---------|-------|
| Action Group Name | `todo-manager-api` |
| OpenAPI Schema | Inline or S3 URI |
| Lambda Handler | `agent-action-handler` |

### 4.3 OpenAPI Schema for Action Group

```yaml
openapi: "3.0.0"
info:
  title: To-Do Manager API
  version: "1.0"
paths:
  /create-task:
    post:
      summary: Create a new task
      operationId: createTask
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [title]
              properties:
                title:
                  type: string
                  description: Task title
                description:
                  type: string
                dueDate:
                  type: string
                  format: date
                priority:
                  type: integer
                  minimum: 0
                  maximum: 3
      responses:
        '200':
          description: Task created
  /update-task:
    put:
      summary: Update an existing task
      operationId: updateTask
      parameters:
        - name: taskId
          in: query
          required: true
          schema:
            type: string
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                title:
                  type: string
                status:
                  type: string
                  enum: [pending, in_progress, completed, cancelled]
                priority:
                  type: integer
      responses:
        '200':
          description: Task updated
  /delete-task:
    delete:
      summary: Delete a task
      operationId: deleteTask
      parameters:
        - name: taskId
          in: query
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Task deleted
```

### 4.4 Create Agent Alias

| Setting | Value |
|---------|-------|
| Alias Name | `prod` |
| Agent Version | Latest draft |

### 4.5 Lambda Resource Policy

Allow Bedrock Agent to invoke the Action Handler Lambda:
```bash
aws lambda add-permission \
  --function-name agent-action-handler \
  --statement-id bedrock-agent-invoke \
  --action lambda:InvokeFunction \
  --principal bedrock.amazonaws.com \
  --source-arn arn:aws:bedrock:REGION:ACCOUNT:agent/*
```

---

## Part 5: Lambda Action Handler (`agent-action-handler`)

**Purpose:** Called by Bedrock Agent via the Action Group. Receives `apiPath`, `httpMethod`, `parameters`, `sessionAttributes`. Executes the actual database operation.

| Config | Value |
|--------|-------|
| Runtime | Python 3.12 |
| Memory | 256 MB |
| Timeout | 10 seconds |
| Package | `psycopg2-binary`, `supabase` |

**Handler:**
```python
import json
import os
from supabase import create_client

supabase = create_client(
    os.environ['SUPABASE_URL'],
    os.environ['SUPABASE_SERVICE_ROLE_KEY']
)

def handler(event, context):
    api_path = event['apiPath']
    http_method = event['httpMethod']
    parameters = event.get('parameters', [])
    session_attrs = event.get('sessionAttributes', {})
    user_id = session_attrs.get('userId', '')

    params = {}
    for p in parameters:
        params[p['name']] = p['value']

    # Route to appropriate handler
    if api_path == '/create-task' and http_method == 'POST':
        return create_task(user_id, params)
    elif api_path == '/update-task' and http_method == 'PUT':
        return update_task(user_id, params)
    elif api_path == '/delete-task' and http_method == 'DELETE':
        return delete_task(user_id, params)
    else:
        return error_response(400, f'Unknown action: {api_path}')

def create_task(user_id, params):
    data = {
        'user_id': user_id,
        'title': params['title'],
        'description': params.get('description', ''),
        'status': 'pending',
        'priority': int(params.get('priority', 0)),
        'due_date': params.get('dueDate'),
    }
    result = supabase.table('tasks').insert(data).execute()
    return success_response(f'Task created: {params["title"]}')

def update_task(user_id, params):
    task_id = params.get('taskId')
    # Verify ownership
    task = supabase.table('tasks').select('*').eq('id', task_id).eq('user_id', user_id).execute()
    if not task.data:
        return error_response(404, 'Task not found or not owned by user')

    updates = {k: v for k, v in params.items() if k != 'taskId'}
    supabase.table('tasks').update(updates).eq('id', task_id).execute()
    return success_response('Task updated')

def delete_task(user_id, params):
    task_id = params.get('taskId')
    supabase.table('tasks').delete().eq('id', task_id).eq('user_id', user_id).execute()
    return success_response('Task deleted')

def success_response(message):
    return {
        'messageVersion': '1.0',
        'response': {
            'actionGroup': 'todo-manager-api',
            'apiPath': '/create-task',
            'httpMethod': 'POST',
            'httpStatusCode': 200,
            'responseBody': {
                'application/json': {
                    'body': json.dumps({'message': message, 'status': 'success'})
                }
            }
        }
    }

def error_response(code, message):
    return {
        'messageVersion': '1.0',
        'response': {
            'httpStatusCode': code,
            'responseBody': {
                'application/json': {
                    'body': json.dumps({'message': message, 'status': 'error'})
                }
            }
        }
    }
```

---

## Part 6: Amazon S3 + CloudFront + SES

### 6.1 S3 Bucket

```bash
aws s3 mb s3://focus-mode-assets --region ap-southeast-1
```

Stores: ambient audio files, generated PDF/Markdown reports, media uploads.

### 6.2 Amazon SES

| Step | Action |
|------|--------|
| 1 | Verify sender domain/email in SES |
| 2 | Initially in sandbox mode — send only to verified addresses |
| 3 | Report Generator Lambda calls SES for daily report delivery |

### 6.3 Amazon EventBridge

| Setting | Value |
|---------|-------|
| Rule Name | `nightly-report-generation` |
| Schedule | `cron(59 16 * * ? *)` (23:59 UTC+7 daily) |
| Target | `focus-report-generator` Lambda |

---

## Part 7: Observability

### 7.1 CloudWatch

- All Lambda logs stream to CloudWatch Logs
- Metrics: invocation count, duration, error rate, throttles
- Alarms: error rate > 5% → notify

### 7.2 AWS X-Ray

- Trace API Gateway → Lambda BFF → Bedrock Agent → Action Handler Lambda → Supabase
- Debug orchestration steps, identify bottlenecks

### 7.3 Bedrock Agent Trace

- Enable in Bedrock console to see:
  - Orchestration steps (Understand → Plan → Elicit → Act)
  - Foundation Model prompts/responses
  - Action Group invocations and results
  - Knowledge Base retrievals

---

## Part 8: Connect Frontend to Cloud

### 8.1 Update `.env`

```env
NUXT_PUBLIC_USE_MOCK_BACKEND=false

# Supabase
NUXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NUXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...

# API Gateway
NUXT_PUBLIC_API_GATEWAY_URL=https://xxxxxxxxxx.execute-api.ap-southeast-1.amazonaws.com/prod
```

### 8.2 User Registration & Approval Flow (Cloud Mode)

When `USE_MOCK_BACKEND=false`, the auth system transitions from in-memory mock to Supabase-native:

| Step | POC Mode | Cloud Mode |
|------|----------|------------|
| **Sign Up** | Insert into `pendingUsers[]` array | Insert into `public.user_requests` table |
| **Admin Approve** | Generate OTP locally | Call Edge Function `approve-user` → `supabase.auth.admin.inviteUserByEmail()` |
| **User Receives** | OTP displayed in toast (mock) | Supabase sends **Invite Email** with secure link |
| **First Login** | `useAuth` detects `otpUsed=false` → `requiresPasswordChange=true` | `profiles.requires_password_change` flag checked on login |
| **Set Password** | `changePassword(newPass)` updates in-memory credentials | `supabase.auth.updateUser({ password })` |
| **Change Password** | Same `changePassword()` function | `supabase.auth.updateUser({ password })` |
| **Forgot Password** | `forgotPassword(email)` generates new OTP | `supabase.auth.resetPasswordForEmail(email)` sends reset link |

**Frontend composable (`useAuth`) uses the same interface for both modes:**
- `signUp(name, email)` → no password needed
- `login(email, password)` → same call for OTP or permanent password
- `changePassword(newPassword)` → updates credentials
- `forgotPassword(email)` → sends reset link/OTP

### 8.3 What Changes When `USE_MOCK_BACKEND=false`

| Component | POC Mode | Cloud Mode |
|-----------|----------|------------|
| `useAuth` | Hardcoded demo credentials | Supabase Auth (or Cognito JWT) |
| `useAgentChat` | Mock `simulateAgentResponse()` | Calls API Gateway → Lambda BFF → Bedrock Agent |
| `useDataService` | In-memory arrays | Supabase REST queries |
| `useEmotionDetector` | Regex heuristic | Lambda via API Gateway |
| `useRAG` | Hardcoded mock | Lambda → pgvector search |
| `useReportExport` | Downloads .md file | Lambda → S3 → SES email |

### 8.3 Deploy Frontend

```bash
npm run build
npx wrangler pages deploy .output/public
```

---

## Part 9: AI Flow — Bedrock Agent Task Creation

```
User types: "I need to write an internship report about cloud architecture"
    │
    ▼
AgentChat.vue → useAgentChat.sendMessage(inputText)
    │
    ├── POC: simulateAgentResponse() evaluates detail level
    │
    └── Cloud: POST /agent/chat → API Gateway → Lambda BFF
              │
              ▼
         Lambda BFF: bedrock_agent_runtime.invoke_agent(
           agentId, aliasId, sessionId, inputText,
           sessionAttributes: { userId }
         )
              │
              ▼
         Bedrock Agent Orchestration Loop
           │
           ├── Understand: "User wants to create a task about internship report"
           │
           ├── Plan: "I need a title, description, due date, priority"
           │
           ├── Categorize detail level:
           │   ├── VAGUE ("write report") → Elicit
           │   │     "What's the report about? When is it due? Priority?"
           │   │     → Return follow-up questions to user
           │   │
           │   └── DETAILED ("internship report about cloud architecture,
           │         due Friday, high priority")
           │         → Act
           │           │
           │           ▼
           │     Action Group: POST /create-task
           │           │
           │           ▼
           │     Lambda Action Handler
           │       • Validates fields, checks user ownership
           │       • INSERT INTO supabase.tasks (user_id, title, ...)
           │       • Returns observation to Agent
           │           │
           │           ▼
           │     Agent: "I've created the task 'Write internship report
           │     about cloud architecture' with high priority, due Friday."
              │
              ▼
         Lambda BFF returns { responseText, tasks[] } to frontend
              │
              ▼
         AgentChat.vue displays agent response + task cards
```

---

## Part 10: Deployment Checklist

### Phase 1: Supabase (1-2 hours)

- [ ] Create Supabase project in `ap-southeast-1`
- [ ] Run `docs/database/schema.sql`
- [ ] Enable pgvector extension
- [ ] Apply RLS policies
- [ ] Create profiles table + `handle_new_user` trigger
- [ ] Store service_role key in AWS Secrets Manager
- [ ] Update `.env` with Supabase URL + anon key

### Phase 2: Lambda Functions (2-3 hours)

- [ ] Deploy `agent-bff` Lambda (IAM: bedrock:InvokeAgent)
- [ ] Deploy `agent-action-handler` Lambda (IAM: secretsmanager:GetSecretValue)
- [ ] Deploy `focus-emotion-detector` Lambda with ONNX layer
- [ ] Deploy `focus-report-generator` Lambda
- [ ] Deploy `focus-rag-recommender` Lambda
- [ ] Deploy `focus-admin-vectorize` Lambda with sentence-transformers layer
- [ ] Test each Lambda via AWS Console

### Phase 3: Bedrock Agent (1-2 hours)

- [ ] Create Task Manager Agent with Claude 3 Haiku
- [ ] Configure Agent Instructions + Guardrails
- [ ] Create Action Group with OpenAPI schema
- [ ] Attach `agent-action-handler` Lambda
- [ ] Create `prod` alias
- [ ] Add Lambda resource policy for Bedrock invocation
- [ ] Test Agent via Bedrock Console test panel

### Phase 4: API Gateway (1 hour)

- [ ] Create REST API with 5 routes
- [ ] Configure JWT authorizer (Supabase)
- [ ] Deploy to `prod` stage
- [ ] Update `.env` with API Gateway URL

### Phase 5: S3 + SES + EventBridge (30 min)

- [ ] Create S3 bucket for reports + media
- [ ] Verify SES sender email
- [ ] Create EventBridge nightly cron rule
- [ ] Test report generation + email flow

### Phase 6: Frontend Switch (30 min)

- [ ] Set `NUXT_PUBLIC_USE_MOCK_BACKEND=false`
- [ ] Test Agent chat → Bedrock → task created in Supabase
- [ ] Test emotion detection → Lambda response
- [ ] Test RAG recommendations → pgvector query
- [ ] Test report export → S3 + SES
- [ ] Deploy to Cloudflare Pages

---

## Part 11: Estimated Monthly Costs (Free Tier)

| Service | Free Tier Limit | Expected Usage | Cost |
|---------|----------------|---------------|------|
| Supabase | 500 MB DB, 50k MAU | ~10 users, <50 MB | **$0** |
| AWS Lambda | 1M requests/month | ~5k requests | **$0** |
| AWS Bedrock Agent | Pay per invocation | ~1k agent invocations | **~$2-5** |
| API Gateway | 1M requests/month | ~5k requests | **$0** |
| S3 | 5 GB storage | ~100 MB | **$0** |
| SES | 62k emails/month | ~300 emails | **$0** |
| EventBridge | Free for AWS targets | 1 rule | **$0** |
| Secrets Manager | 30-day free trial | 1 secret | **$0** |
| CloudWatch | 5 GB logs | < 1 GB | **$0** |
| X-Ray | 100k traces/month | ~5k traces | **$0** |
| Cloudflare Pages | Unlimited | <1 GB | **$0** |

**Total monthly cost: ~$2-5** (Bedrock Agent invocations — the only non-free component)

---

## Part 12: Key Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Bedrock Agent for task input | Natural language → structured tasks without manual forms |
| Agent Orchestration Loop | Handles vague → detailed conversation automatically |
| Lambda BFF pattern | Decouples frontend from Bedrock; handles auth + session mapping |
| Action Group with OpenAPI | Bedrock Agent invokes Lambda with structured contract |
| Supabase as external DB | Agent writes tasks via service_role; RLS protects user data |
| Secrets Manager for credentials | Lambda reads DB credentials securely, not in env vars |
| Claude 3 Haiku | Fast, cost-effective, good instruction following |
| ONNX for emotion detection | Smaller package, faster cold start vs PyTorch |

---

*Deployment plan updated June 8, 2026 — matches `Internship_Architecture.drawio` Bedrock Agent architecture.*
