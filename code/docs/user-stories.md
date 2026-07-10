# User Stories — Focus Mode App (Web-Only, Cloud-Only)

> Cập nhật 2026-07-06 — đồng bộ với bản cài đặt **cloud-only** hiện tại. Nguồn chuẩn khi có mâu thuẫn: `docs/PROJECT_STATE.md`.

> **Derived from:** RFP (Internship Documentation.md)  
> **Platform:** Web-Only (Nuxt 4 + Vue 3) · Supabase (Postgres + Auth + pgvector) backend, cloud-only  
> **Format:** As a `<role>`, I want `<feature>` so that `<value>`.  
> **Priority:** P0 = MVP required, P1 = Phase 2, P2 = Phase 3  
> **Status legend:** ✅ Done (built & working in the app today) · ⏳ Pending AWS backend (AI feature; a client-side fallback runs today where noted) · 🔲 Planned (not built yet)

---

## 1. Authentication

| ID | Priority | Story | Acceptance Criteria | Status |
|---|---|---|---|---|
| US-AUTH-01 | P0 | As a **new user**, I want to **request access with email/password** so that I can create my account. | "Request Access" tab; account created in Supabase Auth; trigger `handle_new_user()` creates `public.users` row with `status='pending'`; user must wait for admin approval before sign-in. | ✅ |
| US-AUTH-02 | P0 | As a **registered user**, I want to **sign in with email/password** so that I can access my focus data. | "Sign In" tab; JWT session established by Supabase Auth; only `status='approved'` users may proceed (pending/rejected are blocked, admins always allowed); cloud data loaded from Supabase. | ✅ |
| US-AUTH-03 | P0 | As a **user**, I want my **session to persist across browser restarts** so that I don't need to log in every time. | `persistSession: true` in Supabase config + a lightweight `focus_auth_user` localStorage snapshot; on app start `syncSession()` re-validates role/status with the DB and force-logs-out demoted/rejected/expired accounts. | ✅ |
| US-AUTH-04 | P1 | As a **user**, I want to **reset my password** so that I can recover access if I forget it. | "Forgot Password" link; `resetPasswordForEmail(email, { redirectTo: appUrl + '/reset-password' })`; dedicated `pages/reset-password.vue` parses the `#access_token/refresh_token/type=recovery` hash, calls `setSession()` then `updateUser({password})`. Requires Supabase Dashboard → Auth → URL Configuration to allowlist `<appUrl>/reset-password` (Redirect URLs) — see `docs/PROJECT_STATE.md`. | ✅ |

---

## 2. Task Management (To-do List)

| ID | Priority | Story | Acceptance Criteria | Status |
|---|---|---|---|---|
| US-TASK-01 | P0 | As a **user**, I want to **create a new task** with a title so that I can plan my work. | "+ Add Task" button opens form (title, description, priority); title required; new task saved straight to Supabase. Tasks created either manually or via the Agent always start with `status='pending'`. | ✅ |
| US-TASK-02 | P0 | As a **user**, I want to **edit a task's title/description/priority/status** so that I can update my plans. | "Edit" opens a modal; changes written straight to Supabase; `updated_at` refreshed. A **completed** task is frozen — only its **review** can be edited (title/description/priority/status locked). | ✅ |
| US-TASK-03 | P0 | As a **user**, I want to **mark a task as complete/incomplete** so that I can track progress. | Checkbox toggle. Completing a task first opens a shared review prompt ("How was this task?") via `TaskReviewDialog`; on save the review is stored and the task is marked completed (strikethrough). Un-completing is immediate. | ✅ |
| US-TASK-04 | P0 | As a **user**, I want to **delete a task** so that I can remove irrelevant items. | "Delete" button; confirmation dialog; task removed from Supabase and list. A task bound to a **running/paused focus session is locked** — `deleteTask` throws `TaskLockedError` and the delete is blocked (same lock as the complete checkbox), so the session's `task_id` reference is never broken. | ✅ |
| US-TASK-05 | P1 | As a **user**, I want to **set a task priority (0-3)** so that I can sort by importance. | Priority selector (None/Low/Medium/High); priority badge (P1–P3) shown in task list. | ✅ |
| US-TASK-06 | P1 | As a **user**, I want **tasks organised by status** so that I can focus on what's next. | Three colour-coded sections — **Pending**, **In Progress**, **Completed** (the old "All" tab is removed); each section shows its count. | ✅ |
| US-TASK-07 | P0 | As a **user**, I want the **checkbox locked while a task is in an active focus session** so that I can't accidentally complete work I'm still doing. | When a task is bound to a running/paused focus session, its checkbox shows a 🔒 and is disabled (`isLockedByFocus`); status is also locked in the Edit modal. | ✅ |

> **Note — Due date:** the **Due date field has been removed from the create form**. The `due_date` column is still kept in the DB/model and rendered when present, but there is no longer a date picker / overdue highlighting in the UI (the original due-date story is therefore not implemented).

---

## 3. Focus Mode (Pomodoro Timer)

| ID | Priority | Story | Acceptance Criteria | Status |
|---|---|---|---|---|
| US-FOCUS-01 | P0 | As a **user**, I want to **start a focus session with a configurable timer** so that I can work in timed blocks. | Duration selector (15/25/45 min); countdown displayed prominently in the centre of the screen. | ✅ |
| US-FOCUS-02 | P0 | As a **user**, I want the **screen to dim/darken during focus** so that I am less distracted. | *Not built yet* — the running view shows the timer + progress bar without a dim overlay or immersive fullscreen mode. | 🔲 |
| US-FOCUS-03 | P0 | As a **user**, I want to **play ambient background sounds** during focus so that I can concentrate better. | Ambient picker (Silence / Rain / Cafe / Waves); the chosen track plays on session start and stops on end/pause. Sounds are **synthesized in-browser via the WebAudio API** (`useAmbientSound.ts`) — no audio files are downloaded or shipped. | ✅ |
| US-FOCUS-04 | P0 | As a **user**, I want to **pause and resume** the timer so that I can take unexpected breaks. | Pause button visible; timer freezes at the exact remaining value; resume re-anchors and continues from that point. | ✅ |
| US-FOCUS-05 | P1 | As a **user**, I want to **select different ambient tracks** so that I can customize my environment. | Track buttons **Rain / Cafe / Waves** (rendered by `AmbientPlayer.vue`); each is procedurally generated from filtered noise via WebAudio — **no S3/CloudFront streaming and no media assets** (the earlier "forest / stream from CDN" plan was dropped). | ✅ |
| US-FOCUS-06 | P1 | As a **user**, I want the **browser tab to show remaining time** so that I can glance without switching tabs. | *Not built yet* — `document.title` is not updated with the countdown. | 🔲 |
| US-FOCUS-07 | P0 | As a **user**, I want the **timer to stay accurate even when the tab is in the background** so that my session length is correct. | Countdown is anchored to a real wall-clock target (`endAt = Date.now() + duration`) and self-corrects on each tick and on `visibilitychange`, instead of counting ticks. | ✅ |
| US-FOCUS-08 | P0 | As a **user**, I want to be **alerted when the timer reaches zero** so that I notice even if I've switched tabs. | On natural completion a WebAudio chime plays **and** a browser `Notification` is shown ("Focus session complete"); permission is requested at session start; clicking the notification refocuses the tab. Manual "End Session" does not fire the alert. | ✅ |
| US-FOCUS-09 | P0 | As a **user**, I want to **link only an in-progress task** to my focus session so that I'm working on something I've actually started. | "Linked Task" dropdown lists only `in_progress` tasks; if none exist, a hint asks the user to set a task to "In Progress" on the Tasks page first. | ✅ |

> **Note — Session persistence:** an in-progress focus session is saved to `localStorage` (`focus_session`) and **restored after a reload / tab discard** (`focus.store.ts` `persist()`/`restore()`). A running timer resumes from its wall-clock anchor; a session that reached zero while the tab was closed jumps straight to the completion screen (skipping the late chime); the journal/emotion are not lost if a save fails.

---

## 4. Post-Focus Journal & Emotion Detection

| ID | Priority | Story | Acceptance Criteria | Status |
|---|---|---|---|---|
| US-EMO-01 | P0 | As a **user**, I want to **write a journal entry after each session** so that I can reflect on my work. | Text area appears after the timer ends; saved with the focus session straight to Supabase. | ✅ |
| US-EMO-02 | P1 | As a **user**, I want the **app to auto-detect my emotion** from my journal text so that I don't have to manually rate my mood. | Journal text is sent to the Lambda `/emotion` endpoint when `NUXT_PUBLIC_API_GATEWAY_URL` is configured; **until then a client-side keyword fallback** (`useEmotionDetector.ts`) returns one of focused/stressed/exhausted/relaxed/unmotivated with a confidence %. | ⏳ |
| US-EMO-03 | P1 | As a **user**, I want to **see my emotion trend over time** so that I can understand my mental patterns. | *Not built yet* — the dashboard shows only the last-session mood; per-session mood is listed (not charted) on the History/Calendar page. No trend chart. | 🔲 |

---

## 5. RAG Content Recommendations

| ID | Priority | Story | Acceptance Criteria | Status |
|---|---|---|---|---|
| US-RAG-01 | P2 | As a **user feeling stressed**, I want to **receive calming content** (quotes, sutras) so that I can feel supported. | After emotion is detected, a card shows the top 1–3 matching media items below the journal. Uses the Lambda `/rag` endpoint when configured; **`useRAG.ts` returns a small hardcoded fallback list until the backend is live**. Knowledge base lives in Supabase (`media_library` + pgvector, `search_similar_content()`). | ⏳ |
| US-RAG-02 | P2 | As a **user**, I want **content recommendations to change based on my emotion** so that the support is relevant. | Exhausted → restorative; Unmotivated → motivational; Relaxed → reflective (server-side matching once `/rag` is deployed). | ⏳ |
| US-RAG-03 | P2 | As a **user**, I want to **open recommended videos** in a new tab so that I can watch them. | External link with `target="_blank"` for video-type media. | ⏳ |

---

## 6. Health Break Reminders

| ID | Priority | Story | Acceptance Criteria | Status |
|---|---|---|---|---|
| US-HLTH-01 | P2 | As a **user**, I want a **browser alert/toast after 2 hours of continuous focus** so that I remember to stretch and hydrate. | `Notification` API or in-app toast after 2 cumulative focus hours. Falls back to toast if permissions denied. | 🔲 |
| US-HLTH-02 | P2 | As a **user**, I want to **dismiss the reminder** so that I can finish my current deep work block. | "Dismiss" button on the toast notification. | 🔲 |

---

## 7. Daily Reports (Markdown / PDF export)

> **Note — LaTeX → Markdown:** the report pipeline was switched from the old LaTeX/Tectonic PDF flow to **Markdown** (`useReportExport.ts`). The `ExportReportButton` downloads an `.md` file client-side today and will POST to the Lambda `/report` endpoint (which can render PDF + email) once that backend is deployed.

| ID | Priority | Story | Acceptance Criteria | Status |
|---|---|---|---|---|
| US-RPT-01 | P1 | As a **user**, I want to **receive a daily email report** with my focus summary so that I can review my productivity. | Scheduled email with an attached report (task summary, focus time, emotion trend, AI suggestion). Needs the Lambda `/report` + SES/EventBridge backend — **not built yet**. | ⏳ |
| US-RPT-02 | P1 | As a **user**, I want the **report to look professional** so that I can share it if needed. | Server-rendered PDF with consistent branding and structured sections via Lambda; **client-side fallback downloads a formatted Markdown (`.md`) report today** (`focus-report-<date>.md`). | ⏳ |
| US-RPT-03 | P1 | As a **user**, I want to **view past reports in the web app** so that I can compare my progress. | *Not built yet* — no stored report archive / presigned-URL viewer. (The History/Calendar page shows raw session history instead.) | 🔲 |

---

## 8. AI Agentic Suggestions

| ID | Priority | Story | Acceptance Criteria | Status |
|---|---|---|---|---|
| US-AI-01 | P2 | As a **user**, I want the **AI to suggest my optimal work time** based on my history so that I can schedule better. | On Dashboard: "Your focus peaks at 22:00. Try scheduling deep work then." Requires the AI backend. | ⏳ |
| US-AI-02 | P2 | As a **user**, I want the **AI to recommend break frequency** so that I avoid burnout. | "You lose focus after ~90 min. Try 25/5 Pomodoro cycles." Requires the AI backend. | ⏳ |
| US-AI-03 | P2 | As a **user**, I want the **AI to prioritize my task list** based on past completion patterns. | Tasks re-ordered with "Suggested Priority" badges. Requires the AI backend. | ⏳ |

> **Note — Task-creation Agent:** the conversational Agent that turns a request into `pending` tasks (`/agent`, `useAgentChat` → `/agent/chat` → Bedrock Agent) also depends on `NUXT_PUBLIC_API_GATEWAY_URL`; with no URL it surfaces an error (there is no local mock). Lambda `agent-bff` + `agent-action-handler` have code but are not deployed.

---

## 9. Dashboard & Analytics

| ID | Priority | Story | Acceptance Criteria | Status |
|---|---|---|---|---|
| US-DASH-01 | P1 | As a **user**, I want to **see my daily/weekly focus time on a chart** so that I can track my consistency. | *Partly built* — the dashboard shows stat cards (Today's Focus, Streak, Tasks Done, Mood) computed inline from Supabase, but **no bar/line time chart yet**. | 🔲 |
| US-DASH-02 | P1 | As a **user**, I want to **see my current streak** (consecutive focus days) so that I stay motivated. | Streak counter on the dashboard, computed inline from session dates (today not-yet-focused doesn't zero an existing streak). | ✅ |
| US-DASH-03 | P1 | As a **user**, I want to **view a heatmap calendar** of my focus activity so that I can spot patterns. | GitHub-style contribution heatmap on the **History/Calendar page** (`calendar.vue`); darker = more focus time. | ✅ |
| US-DASH-04 | P1 | As a **user**, I want the **dashboard to load fast** so that I am not waiting. | Stats computed inline in `dashboard.vue` from Supabase queries (tasks + sessions); no local IndexedDB cache. | ✅ |

---

## 10. Admin CMS (Nuxt 4 — role-gated)

> **Admin gating:** access to `/admin*` is granted **solely by `public.users.role='admin'`** (matching the RLS `is_admin()` helper). The old `ADMIN_EMAILS` env allow-list has been **removed** — the frontend no longer overrides admin by email; a user must have `role='admin'` in the DB.

| ID | Priority | Story | Acceptance Criteria | Status |
|---|---|---|---|---|
| US-ADM-01 | P1 | As an **admin**, I want to **view aggregate user statistics** so that I can monitor platform health. | *Partly built* — the Overview page has navigation cards + a **static** System Health card, and per-page counts exist (approved/pending users, total/embedded media); aggregate focus-hours / most-active-users analytics are **not built yet**. | 🔲 |
| US-ADM-05 | P0 | As an **admin**, I want to **approve or reject pending sign-up requests** so that only vetted people can use the app. | `admin/users.vue` lists users with `status='pending'`; Approve/Reject set `public.users.status` to `approved`/`rejected` (via `useAuth.approveUser`/`rejectUser`), guarded by the `is_admin()` RLS policy. Rejected users appear in a **Rejected** table and can be **re-approved** or **set back to pending** (`useAuth.setUserStatus`). **No** `user_requests` table, `approve-user` edge function, or `profiles` table is used — approval is driven solely by the `users.status` column. | ✅ |
| US-ADM-06 | P1 | As an **admin**, I want to **promote/demote and delete approved users** so that I can manage roles. | Approved-users table with Promote/Demote (toggles `role`) and Delete actions; admins can't act on their own row. | ✅ |
| US-ADM-02 | P1 | As an **admin**, I want to **add new content (quotes/sutras/videos) to the media library** so that the RAG system has fresh material. | Form with title, content_text/url, type (quote/sutra/article/video/audio), source, tags; content is saved to Supabase immediately. **Embedding/vectorization** (per-item "Embed" + "Generate All") calls the Lambda `/embed`/`/embed-all` endpoints — **that vectorizer backend is not deployed yet**. | ⏳ |
| US-ADM-03 | P1 | As an **admin**, I want to **remove content** so that I can curate the library. | Delete button + confirmation removes the item from Supabase. *Note:* this is a **hard delete** — the `is_active` soft-delete described in the original story is not implemented. | ✅ |
| US-ADM-04 | P2 | As an **admin**, I want to **view per-user analytics** so that I can understand individual engagement. | *Not built yet* — no per-user drill-down (session history, emotion trends, report history). | 🔲 |

---

## 11. ~~Offline-First Sync~~ → Cloud-Only (REMOVED)

> **REMOVED — the offline-first architecture has been dropped.** The app is now **cloud-only**: every read/write goes straight to Supabase. There is no IndexedDB, no Dexie, no sync queue, no Last-Write-Wins conflict resolution, and no mock backend. Deleted files: `web/lib/db.ts`, `web/composables/useSyncQueue.ts`. The only remnant is a lightweight **connectivity indicator** (`useOffline.ts` reading `navigator.onLine`, surfaced by `SyncStatus.vue` as an Online/Offline dot plus one dashboard toast) — it does **not** queue or sync anything.

| ID | Priority | Story | Acceptance Criteria | Status |
|---|---|---|---|---|
| ~~US-SYNC-01~~ | ~~P0~~ | ~~Work fully offline on local IndexedDB.~~ | — | ❌ Removed (cloud-only; no offline CRUD) |
| ~~US-SYNC-02~~ | ~~P0~~ | ~~Auto-sync queued changes when back online.~~ | — | ❌ Removed (writes go straight to Supabase; no SyncQueueManager) |
| US-SYNC-03 | P1 | As a **user**, I want to **see my connection status** so that I know whether my changes are reaching the server. | Online/Offline dot via `SyncStatus.vue` (`navigator.onLine`); a dashboard toast warns when offline. No pending/synced badge or last-synced timestamp. | ✅ Replaced with connectivity indicator only |
| ~~US-SYNC-04~~ | ~~P1~~ | ~~Latest-edit-wins (LWW) conflict resolution across tabs.~~ | — | ❌ Removed (no conflict resolution; Supabase is the single source of truth) |

---

## 12. Cross-Cutting (Web-Specific)

| ID | Priority | Story | Acceptance Criteria | Status |
|---|---|---|---|---|
| US-CC-01 | P0 | As a **user**, I want the **app to load quickly** so that I can start working immediately. | Target: Lighthouse Performance > 90; first contentful paint < 1.5s. Not formally measured yet. | 🔲 target |
| US-CC-02 | P0 | As a **developer**, I want **automated CI/CD** so that every push is tested and built. | *Not wired* — the committed pipeline targets the wrong platform (Cloudflare Pages) and the deploy target is moving to **AWS Amplify** (`nuxt generate` static build). See `Plan_and_Deploy.md`. | 🔲 |
| US-CC-03 | P1 | As a **user**, I want the **app to be responsive** so that it works on both desktop and tablet browsers. | Layout adapts; comfortable from small tablet widths up to 1920px. | ✅ |
| US-CC-04 | P1 | As a **user**, I want the **app to work in Chrome, Firefox, and Edge** so that I can use my preferred browser. | Target: cross-browser testing on latest 2 versions of each (not formally verified). | 🔲 target |
| US-CC-05 | P1 | As a **user**, I want the **focus timer to continue even if I switch tabs** so that I don't lose progress. | Countdown derived from a wall-clock anchor (`endAt`) and re-checked by a `setInterval` tick + `visibilitychange` listener, so it stays accurate through background-tab throttling (see US-FOCUS-07). | ✅ |
