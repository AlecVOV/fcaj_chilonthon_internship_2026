## FE Evaluation — Bedrock Agent Migration

### What the web Codebase Currently Has

| Layer | Existing | Bedrock Agent Needs |
|-------|---------|-------------------|
| **Auth** | useAuth.ts — Supabase Auth (JWT) | ✅ Same — Cognito or Supabase Auth, JWT passed through |
| **Task Input** | Manual form (title + description) in tasks.vue | 🔄 Replace with **chat input** — user types natural language, agent processes |
| **Task CRUD** | task.store.ts + useDataService.ts — direct DB writes | 🔄 Agent writes via Lambda Action Handler, NOT direct from frontend |
| **API Layer** | useEmotionDetector.ts, useRAG.ts, useReportExport.ts call Lambda via API Gateway | 🔄 Add **Agent BFF endpoint** — POST to API Gateway → Lambda BFF → Bedrock InvokeAgent |
| **Task Display** | tasks.vue table with manual edit/delete | ✅ Keep — tasks added by Agent still need display |
| **Post-Session Journal** | focus.vue journal → emotion detection | ✅ Keep — separate from Agent task input |
| **Admin** | `admin/index.vue`, users.vue, media.vue | ✅ Keep — admin manages users + media library |

### What Needs to Change in web

#### 🔴 REMOVE (no longer needed with Bedrock Agent)

| File | What to Remove | Why |
|------|---------------|-----|
| `pages/index.vue` | "Add Task" button + inline task form | Agent handles task creation via chat |
| `pages/tasks.vue` | "Add Task" button + add/edit forms | Same — Agent creates tasks |
| `stores/task.store.ts` | `addTask()`, `updateTask()`, `deleteTask()` write methods | Agent writes via Lambda, not client-side store |

#### 🟡 ADD (new components needed)

| New File | Purpose |
|----------|---------|
| **`components/AgentChat.vue`** | Chat input where user types task requests, displays agent responses + follow-up questions |
| **`composables/useAgentChat.ts`** | Calls API Gateway → Lambda BFF → Bedrock InvokeAgent, manages sessionId across turns |
| **`pages/agent.vue`** | New page: Agent task input with chat history |

#### 🟢 UPDATE (modify existing)

| File | Change |
|------|--------|
| `layouts/default.vue` | Add "Agent" nav link for users (next to Dashboard, Focus, Tasks, History) |
| `pages/index.vue` | Replace "Add Task" button with agent CTA |
| `pages/tasks.vue` | Keep table display, remove add/edit/delete buttons (tasks are agent-managed) |
| `stores/task.store.ts` | Keep `fetchTasks()`, `toggleTask()` for display; remove write methods |
| nuxt.config.ts | Add `/agent` route with `ssr: false` |

#### ✅ KEEP (no changes)

| File | Reason |
|------|--------|
| useAuth.ts | Auth unchanged — same JWT flow via Cognito/Supabase |
| `pages/focus.vue` | Focus timer unchanged |
| `pages/calendar.vue` | History unchanged |
| `composables/useEmotionDetector.ts` | Emotion detection unchanged |
| `composables/useRAG.ts` | RAG recommendations unchanged |
| `pages/admin/*` | Admin unchanged |
| All `stores/` except task.store.ts | Focus, user stores unchanged |

---

Now rewriting deployment-plan.md for Bedrock Agent architecture: