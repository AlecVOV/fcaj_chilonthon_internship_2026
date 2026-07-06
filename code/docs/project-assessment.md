# Focus Mode App — Comprehensive Project Assessment

> Cập nhật 2026-07-06 — đồng bộ với bản cài đặt cloud-only hiện tại. Nguồn chuẩn khi có mâu thuẫn: `docs/PROJECT_STATE.md`.
>
> **Update (2026-07-06):** (1) Pipeline report đã **bỏ LaTeX/Tectonic** — nay render **Markdown (UTF‑8)** trong `web/composables/useReportExport.ts`, nên mọi nhận định về LaTeX / XeLaTeX / `sanitizeForLatex` bên dưới đã **lỗi thời** và được đánh dấu tại chỗ. (2) Đã **gỡ env `ADMIN_EMAILS`** — admin chỉ còn xác định bằng `public.users.role='admin'` (khớp RLS `is_admin()`). (3) Migrations đã có tới **`00009`** (hardening DB: trigger chặn leo quyền, FK `users→auth.users`, drop `sync_log`, index `users.status`) — vẫn **cần chạy `00009`** trong Supabase SQL Editor. (4) Đợt rà local + DB (2026-07-05) landing thêm nhiều fix (xem §2.8). (5) Còn mở: AWS AI (4/6 lambda chưa code) + Amplify chưa deploy; P0 auth JWT + route mismatch; Supabase "Confirm email" phải **TẮT**.

**Date:** May 22, 2026  
**Author:** GitHub Copilot (DeepSeek V4 Pro)  
**Project Stage:** MVP + Phase 2 (Frontend built, back-end partially implemented)  

---

## 1. Project Overview

**Focus Mode App** is a cloud-native (cloud-only) productivity application that combines Pomodoro-style focus timers with AI-powered emotion detection, content recommendations (RAG), and automated daily PDF reports. The application is designed for knowledge workers and students who want to:

> **Update (2026-06-29):** The offline-first layer has been **removed**. There is no longer IndexedDB/Dexie, sync queue, Last-Write-Wins, or mock backend. All reads/writes go directly to Supabase. See §2.2 / §3.10 for details.

- Enter deep-focus "immersive" sessions with ambient sounds and a dimmed screen
- Track productivity through task management and focus time analytics
- Receive post-session emotion analysis via NLP (distilbert model)
- Get personalized content recommendations based on emotional state (RAG + pgvector)
- Receive automated daily reports (Markdown, UTF‑8 native); email delivery via Amazon SES is planned (the `report-generator` Lambda is not yet implemented)

The target user is a single-user productivity scenario — a student or professional managing their own focus sessions and tasks. The architecture is designed to run entirely on cloud free tiers ($0 infrastructure budget).

**Tech Stack:**
| Layer | Technology |
|---|---|
| Frontend | Nuxt 4, Vue 3, Pinia, Tailwind CSS (cloud-only — Dexie/IndexedDB **removed**) |
| Backend (BaaS) | Supabase Cloud (PostgreSQL + pgvector, Auth) |
| Serverless Compute | AWS Lambda (Python) — only `agent-bff` & `agent-action-handler` have code; others are spec/README only |
| API Gateway | Amazon API Gateway (OpenAPI spec only — **not deployed**) |
| Storage | Amazon S3 (ambient audio, report PDFs) — planned |
| Email | Amazon SES — planned |
| CI/CD | **None yet** (no SAM/Terraform/CDK; only per-Lambda `deploy.sh`) |
| NLP Model | distilbert-base-uncased-emotion (ONNX quantized) — spec; current emotion uses client-side regex fallback |
| Embedding Model | all-MiniLM-L6-v2 (384-dim) |
| Report format | Markdown (UTF‑8) — the old LaTeX/Tectonic pipeline was **removed**; frontend renders Markdown, falls back to a `.md` download when no API is configured |

---

## 2. Strengths (Pros)

### 2.1 Architecture Excellence — Event-Driven, Cloud-Native, Serverless

The system avoids monolithic design entirely. It combines **Supabase Cloud BaaS** (auth, database, vector store), **AWS Lambda** (emotion detection, report generation, AI suggestions, admin vectorization), **EventBridge** (nightly cron for report generation), **API Gateway** (secure routing), and **S3/SES** (storage/email). This is genuinely production-grade thinking — each component has a single responsibility, scales independently, and stays within free-tier limits.

### 2.2 Cloud-Only Data Layer (offline-first REMOVED)

> **Update (2026-06-29):** The offline-first design described below is **no longer present**. The Dexie.js (IndexedDB) layer, the sync queue, Last-Write-Wins conflict resolution, and the mock backend have all been removed. Deleted files: `web/lib/db.ts`, `web/composables/useSyncQueue.ts`; the `NUXT_PUBLIC_USE_MOCK_BACKEND` flag and all in-memory mock/OTP stores are gone. `web/composables/useOffline.ts` still exists but is **only a connectivity indicator** (`navigator.onLine` → an Online/Offline dot plus one dashboard toast); it does **not** queue or sync. `web/components/SyncStatus.vue` now only shows Online/Offline. All reads/writes go straight to Supabase via `web/composables/useDataService.ts`.

~~The Dexie.js (IndexedDB) layer with a sync queue is properly architected. All writes go local-first, then queue to Supabase when online. The Last-Write-Wins (LWW) conflict resolution based on `updated_at` is simple but appropriate for a single-user productivity app.~~ The `SyncStatus` component now provides simple connectivity feedback only.

### 2.3 AI Integration (partially implemented)

> **Update (2026-06-29):** The ML models below are still the design intent, but most of the serverless AI is **not yet running**. Only `agent-bff` and `agent-action-handler` have real Python code; `emotion-detector`, `rag-recommender`, `admin-vectorizer`, and `report-generator` are README/spec only. The model layers (`onnx-transformers`, `sentence-transformers`) are spec only, and API Gateway/Bedrock are not deployed. When no `NUXT_PUBLIC_API_GATEWAY_URL` is configured the agent chat errors out (no mock), while emotion detection falls back to a client-side regex and RAG falls back to hardcoded suggestions.

The project's design uses actual ML models:
- **distilbert-base-uncased-emotion** quantized to ONNX (~82 MB) for 5-label emotion classification from journal text (labels: focused, stressed, exhausted, relaxed, unmotivated) — **not yet deployed; client regex fallback in use**
- **all-MiniLM-L6-v2** (384-dim embeddings) for semantic similarity search in pgvector — DB side is ready (`VECTOR(384)`, `search_similar_content()`, ivfflat cosine index); the recommender Lambda is README only
- Proper Lambda layer architecture for model deployment — **spec only**

The Agent chat path is genuinely wired: `useAgentChat` → `POST {API}/agent/chat` → `agent-bff` Lambda → Bedrock Agent → `agent-action-handler` Lambda (create/update/delete tasks in Supabase). Both of those Lambdas have working Python code; the remaining AI is design only.

### 2.4 Professional Documentation Suite

The `docs/` folder is comprehensive:
- Complete PostgreSQL/pgvector schema with indexes, triggers, RLS policies
- API contracts with detailed request/response schemas
- NLP and RAG specifications with model selection rationale
- Testing plan (Vitest + pytest + Playwright)
- User stories derived from RFP
- Markdown report template with `{{PLACEHOLDER}}` variables (defined in `useReportExport.ts`; the old `docs/latex-template.tex` has been removed)

### 2.5 Thoughtful UI Design System

The AWS Console-inspired design with custom color tokens (`neutral-100` to `neutral-950`, `interactive-blue`, `brand-orange`, `squid-ink`) and proper light/dark mode support shows restraint and professionalism. The "no icons" rule is an interesting constraint that forces clean typography-based UI.

### 2.6 Cost-Optimized ($0 Budget)

Every service choice is justified against free-tier limits:
- Supabase Free Tier: 500 MB database, 50k MAU
- AWS Lambda: 1M requests/month free
- S3: 5 GB free
- SES: 62,000 emails/month free
- All-MiniLM-L6-v2 chosen over larger models to fit Lambda's 512 MB memory limit
- Markdown report generation (no heavy LaTeX/Tectonic toolchain) keeps the Lambda small and avoids Unicode-encoding hacks

### 2.7 Vietnamese Unicode — Markdown handles it natively (LaTeX sanitizer REMOVED)

> **Update (2026-07-06):** The `sanitizeForLatex` workaround (NFD decomposition + Vietnamese tone-mark removal + LaTeX escaping) has been **removed** along with the LaTeX pipeline. `useReportExport.ts` now emits **Markdown (UTF‑8)**, which renders Vietnamese diacritics correctly with no lossy sanitization. The former pdfLaTeX/T1 encoding limitation no longer applies.

~~The `sanitizeForLatex` function in `useReportExport.ts` with NFD decomposition, Vietnamese tone mark removal, and LaTeX special character escaping is a well-thought-out solution to the pdfLaTeX/T1 encoding limitation — a practical engineering tradeoff documented and explained.~~

### 2.8 Recent UX Improvements (2026-06-29 → 2026-07-05)

> Added to reflect work landed since the original assessment:

- **Focus timer is now wall-clock accurate.** The countdown is anchored to a real timestamp (`endAt = Date.now() + duration`), so it stays correct even when the tab is backgrounded — it self-corrects each tick and listens for `visibilitychange`. On completion it plays a WebAudio chime and fires a **browser Notification** (permission is requested at Start; clicking the notification returns to the app). Only `in_progress` tasks can be attached to a focus session, and the task title is snapshotted into the store for stable display.
- **Tasks page reworked.** Three colored sections — Pending, In Progress, Completed — replace the old "All" tab. Ticking a task to complete first opens a shared **"How was this task?" review dialog** (`web/components/TaskReviewDialog.vue`, mounted in the layout so it works on both the Tasks page and the dashboard's "Today's Tasks" widget). Full per-task **CRUD** (Edit + Delete) is available; for Completed tasks Edit can only change the review (title/description/priority/status are locked). New tasks (from both "+ Add Task" and the Agent) are created as `status='pending'`. The complete tick is **locked (🔒)** while the task is bound to a running/paused focus session.
- **Local + DB hardening pass (2026-07-05).** A review pass landed: Ambient player now plays **real audio** (WebAudio + fixed binding); focus session **persists across reload** and journal is not lost when a save fails; **old-password verification** on change; task **Delete is locked** while bound to focus; **three dashboard stats bugs** fixed (mood / tasks-done / streak); session is **re-validated on app open** (`syncSession()` → auto-logout if demoted/rejected); admin gets a **Rejected users** section; task list shows an **error banner + Retry** (`loadError`); the Worklog now folds in days that have **only tasks** (no focus session). DB-side: migration `00009` (hardening).

## 3. Weaknesses / Risks (Cons)

### 3.1 Missing Lambda Implementations

> **Update (2026-06-29):** Of the six Lambdas, two now have real code (`agent-bff`, `agent-action-handler`). The following four remain **documented but not yet implemented** (README only):

- **report-generator**: Markdown report rendering + S3 upload + SES email (the LaTeX/Tectonic step is gone; format is now Markdown)
- **emotion-detector**: ONNX emotion classification from journal text
- **admin-vectorizer**: Admin-triggered embedding generation for media library
- **rag-recommender**: Semantic similarity search against pgvector

Additionally, the model layers are spec only, API Gateway and Bedrock are not deployed, and there is no CI/CD or IaC (SAM/Terraform/CDK) — only a per-Lambda `deploy.sh` for the two coded Lambdas.

The frontend has fallback hardcoded data for RAG recommendations and, when no API is configured, downloads the report as a raw `.md` file (there is no server-side rendering/emailing yet). For a High Distinction submission, at least the report generator Lambda should be completed.

### 3.2 LaTeX Unicode Limitation — RESOLVED (LaTeX pipeline removed)

> **Update (2026-07-06):** This risk is **obsolete**. The LaTeX pipeline and the `sanitizeForLatex` diacritic-stripping step have been removed; reports are now generated as **Markdown (UTF‑8)**, which preserves Vietnamese accents natively. No XeLaTeX switch is needed.

~~The current `sanitizeForLatex` approach strips all Vietnamese diacritics. While this prevents compilation errors, it means Vietnamese names appear without proper accents in reports (e.g., "Đi ỉa" → "Di ia"). The specified solution (switch to XeLaTeX) is mentioned but not implemented. This is acceptable for MVP but would be problematic for real Vietnamese users.~~

### 3.3 No Real Backend Tests

The testing plan specifies pytest for Lambda functions, but the test cases listed (RG-01, RG-02) are minimal — they only test report-string (Markdown) generation, not actual Lambda handler functions. There are no tests for:
- Emotion detection Lambda handler (ED-01, ED-02 are specified but may not be implemented)
- RAG recommender Lambda
- Admin vectorizer Lambda
- Report generator end-to-end (API Gateway → Lambda → S3 → SES)

### 3.4 LWW Conflict Resolution Limitations — NO LONGER APPLICABLE

> **Update (2026-06-29):** This risk is **obsolete**. The offline sync queue and Last-Write-Wins conflict resolution have been removed; the app is cloud-only and writes go directly to Supabase, so there is no client-side conflict resolution to reason about.

~~Last-Write-Wins based on `updated_at` works for a single-user app but could lose data if the user opens two tabs simultaneously, clock skew causes incorrect ordering, or a slow network causes an older write to arrive after a newer one.~~

### 3.5 Pinia SSR/Import Reliability Issues

During development, the `useUserStore is not defined` error appeared multiple times due to:
- `imports.dirs` auto-import conflicts with explicit imports
- Pinia stores calling `ref`/`computed` without Vue imports (Nuxt auto-imports are not guaranteed in `.ts` store files)
- Stale `.nuxt` cache causing module resolution failures

The fix (explicit imports everywhere) is correct but fragile — any new developer adding a store could hit the same issue.

### 3.6 No Real-Time Features

Despite Supabase supporting Realtime subscriptions, the app uses polling/nothing for updates. Multi-device sync would benefit from Realtime broadcast. The documentation mentions Supabase Realtime but the frontend doesn't implement it.

### 3.7 Free Tier Limits Risk

While well-planned, free tier limits are real constraints:
- Lambda: 1M requests/month (emotion detection could consume this quickly with many users)
- Supabase: 500 MB database (pgvector embeddings grow with content)
- S3: 5 GB (ambient audio files + generated PDFs)
- SES: 62k emails/month (daily reports for many users)

The project would need a paid tier migration plan for production use.

### 3.8 Security Considerations Not Fully Addressed

> **Update (2026-06-29):** The user-approval flow has been reworked. The legacy approach (the `profiles` table, `user_requests` table, and the `approve-user` edge function) was **removed in migration `00007`**. The real flow is now: sign-up triggers `handle_new_user()`, which inserts a `public.users` row with `status='pending'` (admins auto-`'approved'`); admins approve/reject by `UPDATE`-ing `users.status`, protected by RLS via the recursion-safe `is_admin()` function. Do **not** describe profiles / user_requests / approve-user as current.
>
> **Update (2026-07-06):** Two more items landed. (1) The frontend env override **`ADMIN_EMAILS` has been removed** — admin is now determined **only** by `public.users.role='admin'` (`useAuth.ts`, matching RLS `is_admin()`); the admin allow-list lives in the `handle_new_user()` trigger (migration `00008`). (2) The RLS **privilege-escalation hole** (a user self-`UPDATE`-ing `role='admin'`/`status='approved'`) is patched at the DB layer by migration **`00009`** via a `BEFORE UPDATE` trigger `guard_user_self_update()` (a `WITH CHECK` policy could not fix it because the unchanged `id` still passes); `00009` also tightens `daily_worklogs`/`daily_stats` INSERT, adds FK `users→auth.users`, and drops `sync_log`. ⚠️ `00009` still **needs to be run** in the Supabase SQL Editor.

- Row Level Security (RLS) policies are defined in the schema (including `is_admin()`-based admin policies, migration `00006`) but their end-to-end behavior is not yet verified by tests; the self-update guard was added in `00009`
- API Gateway JWT validation is mentioned but the actual authorizer configuration is not shown (API Gateway is not deployed). **P0 open:** the frontend currently sends `Authorization: Bearer = currentUser.id` (a UUID) instead of the Supabase JWT, so a JWT authorizer would reject every call — this must be fixed before deploy
- Admin role check in the frontend (via `useAuth`/`user.store`) is still convenience-only — the real security is the RLS `is_admin()` policies plus the `00009` guard trigger at the DB level (and, once deployed, the API Gateway/Lambda layer)

> **Schema accuracy note (2026-06-29):** A few earlier draft claims do not match the current DB and should be considered corrected:
> - `media_library.type` matches the DB — **5 values**: `quote`, `sutra`, `video`, `article`, `audio`.
> - `daily_stats` has **only** `created_at` (no `updated_at` column), so it does **not** need an `updated_at` trigger — its absence is not a defect.
> - The RAG DB side is complete: pgvector `embedding_vector VECTOR(384)`, the `search_similar_content()` function, and an `ivfflat` cosine index are all present.

### 3.9 E2E Tests Deferred

Playwright E2E tests are marked "optional for MVP" in the testing plan. For a High Distinction submission, some E2E coverage of the core flow (login → add task → start focus → journal → view report) would strengthen the evaluation.

### 3.10 No PWA/Offline Service Worker — DESIGN CHANGED

> **Update (2026-06-29):** This is no longer a gap, because offline support was intentionally dropped. The app is now **cloud-only**: there is no IndexedDB/Dexie, no sync queue, and no PWA service worker by design. `useOffline.ts` only reports connectivity. If offline capability is ever desired again it would have to be re-introduced from scratch.

---

## 4. Enhancement Recommendations

### High Priority (Before Final Submission)

| # | Recommendation | Effort | Impact |
|---|---|---|---|
| 1 | **Implement report-generator Lambda** — render the Markdown report, S3 upload, SES email | 2-3 days | Critical — core feature, 40% of evaluation |
| 2 | **Add explicit `ref`/`computed` imports to all Pinia store files** — prevent `useUserStore is not defined` errors | 1 hour | Critical — blocking bug |
| 3 | **Write pytest tests for emotion detection Lambda handler** — test with real/simulated journal text | 1 day | High — 70% coverage target |
| 4 | ~~Add integration test for sync queue → Supabase push~~ — **obsolete (offline sync removed; cloud-only)** | — | — |
| 5 | **Verify and test Supabase RLS policies** — ensure users can't access other users' data | 4 hours | High — security |
| 6 | ~~Switch from pdfLaTeX sanitization to XeLaTeX with Unicode support~~ — **obsolete (LaTeX pipeline removed; reports are Markdown/UTF‑8, Vietnamese renders natively)** | — | — |

### Medium Priority (Polish)

| # | Recommendation | Effort | Impact |
|---|---|---|---|
| 7 | ~~Add PWA service worker~~ — **obsolete (offline-first dropped by design; cloud-only)** | — | — |
| 8 | **Implement rag-recommender Lambda** — replace hardcoded fallback recommendations (DB side already has pgvector + `search_similar_content`) | 1 day | Demo-quality AI feature |
| 9 | **Add more ambient sound tracks** — upload to S3 and populate the media picker | 2 hours | User experience |
| 10 | **Improve toast notification system** — consolidate ExportReportButton toast into a global composable | 2 hours | Code quality |
| 11 | **Add document title countdown** — show remaining time in browser tab during focus | 30 min | User experience |
| 12 | **Implement Web Vitals monitoring** — track LCP, FCP, CLS for performance report | 1 hour | Professional polish |

### Low Priority (Future)

| # | Recommendation | Effort | Impact |
|---|---|---|---|
| 13 | **Multi-language i18n** — Vietnamese + English with `@nuxtjs/i18n` | 2-3 days | Future users |
| 14 | **Real-time sync via Supabase Realtime** — broadcast changes across browser tabs | 1 day | Multi-device |
| 15 | **Leaderboard / social features** — streak comparison (opt-in) | 2 days | Engagement |
| 16 | **Export to Notion / Google Docs API** — alternative to PDF | 1 day | Integration |
| 17 | **Mobile PWA with Capacitor** — native-like experience | 3-5 days | Mobile reach |

---

## 5. Overall Assessment

### Readiness for High Distinction: **7.5 / 10**

**Justification:**

The project demonstrates exceptional technical breadth and depth:
- **Cloud-native** — managed BaaS (Supabase) with all reads/writes going directly to the cloud (offline-first client has been removed; see §2.2)
- **AI/ML integration in progress** — two agent Lambdas have real code; ONNX emotion detection and pgvector RAG are designed and DB-ready but not yet deployed (see §2.3 / §3.1)
- **Professional documentation** — schema, API contracts, NLP/RAG specs, testing plan
- **Thoughtful tradeoffs** — model size vs Lambda memory; Markdown reports (no LaTeX toolchain) for native UTF‑8/Vietnamese

**What's holding it back from a 9 or 10:**
- **4 of 6 Lambda functions are not implemented** — `report-generator`, `emotion-detector`, `admin-vectorizer`, and `rag-recommender` are README/spec only; only `agent-bff` and `agent-action-handler` have code. API Gateway/Bedrock are not deployed and there is no CI/CD. The report generator is explicitly promised in the RFP.
- **Testing is planned but minimal** — the 70% coverage target won't be met without actual Lambda tests
- **Deploy blockers still open** — `00009` not yet run; P0 auth (frontend sends the user UUID instead of a Supabase JWT) and the FE↔OpenAPI route mismatch are unresolved; Amplify build config (`nuxt generate` + `amplify.yml`) is not in place
- **Pinia import reliability** — the pattern of stores using `ref`/`computed` without explicit imports is fragile and has caused real compilation errors

**To reach 9/10:** Implement the report generator Lambda end-to-end (Markdown report → S3 → SES email), add Lambda handler tests, and close the P0 deploy blockers (run `00009`, JWT auth, route mismatch).

**To reach 10/10:** Complete all Lambda functions, deploy API Gateway + Bedrock and add CI/CD, achieve 70%+ test coverage with E2E tests, implement the RAG recommender with real pgvector queries, and deploy to a live domain.

---

## 6. Next Steps Checklist

### Immediate (This Week)

- [ ] **Fix Pinia imports** — Add `import { ref, computed } from 'vue'` to `user.store.ts`, `task.store.ts`, `focus.store.ts`
- [ ] **Implement report-generator Lambda** — Python, render the Markdown report, upload to S3, send SES email (currently README only; frontend falls back to a client-side `.md` download)
- [ ] **Add API Gateway route** — `POST /report` → Lambda with JWT authorizer (also resolve the FE `/report` ↔ OpenAPI route naming)
- [ ] **Test export flow end-to-end** — Dashboard → "Export Report" → Lambda → S3 → SES → email received

### Short-Term (Before Final Demo)

- [ ] **Write Lambda unit tests** — pytest for each Lambda handler (at least 5 tests per Lambda)
- [ ] ~~Add Vitest tests for sync queue~~ — **obsolete (offline sync queue removed; app is cloud-only)**
- [ ] **Verify Supabase RLS** — test that user A cannot read user B's tasks via API; confirm the `00009` self-update guard blocks self-promotion to admin
- [ ] ~~Consider XeLaTeX~~ — **obsolete (LaTeX pipeline removed; reports are Markdown/UTF‑8)**
- [ ] **Create demo screencast** — record the full user flow (login → tasks → focus → journal → report)

### Before Submission

- [ ] **Achieve 70% test coverage** — verify with `vitest --coverage` and `pytest --cov`
- [ ] **Deploy to AWS Amplify** — add `amplify.yml` + `nuxt generate` (static SPA), configure `NUXT_PUBLIC_*` env vars, verify live URL (target platform is now Amplify, not Cloudflare Pages)
- [ ] **Update documentation** — any architectural changes since `docs/` was generated
- [ ] **Prepare pitch deck** — architecture diagram, demo flow, technical highlights
- [ ] **Final code review** — remove console.log, unused imports, dead code

---

*Report generated by GitHub Copilot (DeepSeek V4 Pro) after comprehensive analysis of project documentation, source code, and architectural decisions.*
