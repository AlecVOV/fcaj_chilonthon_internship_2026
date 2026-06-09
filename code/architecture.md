Understood. This is a clean **Agentic Task Management** architecture, distinct from the Focus Mode App. Let me confirm I've read it correctly:

---

## Your Bedrock Agent Architecture — My Understanding

### Flow Diagram (from your draw.io)

```
User/Client App
    │  Login
    ▼
Cognito / IdP ─── JWT ──────────────────────────┐
    │                                              │
    │  HTTPS + JWT + user message                  │
    ▼                                              │
AWS WAF (edge protection)                          │
    │                                              │
    ▼                                              │
API Gateway (auth, throttling) ◄── JWT validation ─┘
    │
    ▼
Lambda BFF (Backend For Frontend)
    │  Validate request, map user → sessionId
    │  Call Bedrock InvokeAgent(agentId, aliasId, sessionId, inputText)
    ▼
Agent Alias (prod)
    │
    ▼
Task Manager Agent ── Guardrails (PII/safety) ── Foundation Model (Claude/Nova)
    │
    ▼
Agent Orchestration Loop
    Understand → Plan → Elicit → Act
    │              │         │        │
    │              │         │        ▼
    │              │         │   Action Group: To-Do Manager API
    │              │         │   (OpenAPI Schema defines operations)
    │              │         │        │
    │              │         │        ▼
    │              │         │   Lambda Action Handler
    │              │         │   (create/update task logic)
    │              │         │        │
    │              │         │        ▼
    │              │         │   Secrets Manager → Supabase PostgreSQL
    │              │         │
    │              │         ▼
    │              │   Missing params? → Elicit follow-up questions → return to user
    │              │
    │              ▼
    │        Knowledge Base (task policies, examples) — optional
    │
    ▼
Response back to user via API Gateway:
    - Follow-up questions (if more info needed)
    - Final answer: "Task created/updated"
```

### Your Task Input Flow

```
User: "I need to write a report"
    │
    ▼
Agent evaluates: ⚠️ NOT detailed enough
    │
    ▼
Agent asks: "What's the report about? When is it due? Priority level?"
    │
    ▼
User: "Internship final report, due Friday, high priority"
    │
    ▼
Agent evaluates: ✅ Detailed enough
    │
    ▼
Agent generates and writes to DB:
    Task 1: "Write internship final report" [high] [due Friday]
    Task 2: "Review internship report before submission" [medium] [due Thursday]
    │
    ▼
Response: "I've added 2 tasks to your to-do list"
```

### What I'll Do Next

I will **not modify anything** in your draw.io file. I understand the architecture. When you're ready, I can help:

1. **Write the Lambda BFF** — the function that sits between API Gateway and Bedrock, mapping users to sessions
2. **Write the Lambda Action Handler** — the function Bedrock calls to actually create/update tasks in Supabase
3. **Define the OpenAPI Schema** — the tool contract Bedrock uses to invoke the action
4. **Configure Bedrock Agent** — agent instructions, prompt templates, guardrails
5. **Wire Supabase** — credentials in Secrets Manager, RLS policies for user ownership

Ready when you are — what would you like me to implement first?