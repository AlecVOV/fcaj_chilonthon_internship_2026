# PROJECT_STATE — Focus Mode App (đọc file này TRƯỚC)

> Bản "trạng thái chuẩn" (single source of truth) để bất kỳ ai — kể cả một phiên Claude mới — nắm toàn bộ project từ đầu tới hiện tại rồi tiếp tục phát triển. Cập nhật: **2026-07-08**.
>
> Cặp đôi với file này: **`Plan_and_Deploy.md`** (lộ trình deploy cloud/AWS + lịch 2 tuần + diagram + PPT + test plan). Các file `docs/` khác được đồng bộ code ngày 2026-06-29; các thay đổi tính năng ngày 2026-07-05 (đợt rà local+DB) có thể CHƯA phản ánh hết vào chúng → **file này (PROJECT_STATE) là nguồn chuẩn** khi có mâu thuẫn.

---

## 0. Một phút nắm bắt
- Sản phẩm: **"Focus Mode App"** (tên hiển thị "FCAJ Worklog Repository") — app quản lý phiên tập trung (Pomodoro) + task + nhật ký cảm xúc + gợi ý nội dung (RAG), kèm trợ lý AI tạo task.
- Kiến trúc: **Nuxt SPA** (`ssr:false`) ở `web/`, **Supabase** (Postgres + Auth + pgvector) làm backend **cloud-only**. Tính toán AI dự kiến trên **AWS Lambda + API Gateway + Bedrock** (`aws/`) — **phần lớn CHƯA deploy**.
  - ⚠️ **Phiên bản Nuxt thực tế:** `package.json` khai `nuxt ^3.15` (**Nuxt 3**) dù nhiều doc/tiêu đề gọi "Nuxt 4". Khi build/deploy, coi là **Nuxt 3** (SPA static bằng `nuxt generate`).
- Giai đoạn hiện tại: **app + DB đã chạy thật trên cloud; chuẩn bị deploy frontend lên AWS Amplify và nối các component AI**. Mức độ sẵn sàng tổng thể ~40% (chi tiết trong `Plan_and_Deploy.md`).
- Thư mục: `web/` (frontend) · `supabase/` (DB + migrations + RLS) · `aws/` (lambda/infra spec) · `docs/` (tài liệu).

---

## 1. Kiến trúc & sự thật hiện hành

### Cloud-only — offline-first ĐÃ GỠ
- KHÔNG còn offline-first, IndexedDB, Dexie, sync queue, Last-Write-Wins, mock backend.
- Đã xóa: `web/lib/db.ts`, `web/composables/useSyncQueue.ts`, cờ `NUXT_PUBLIC_USE_MOCK_BACKEND`, mọi mock/OTP in-memory.
- `web/composables/useOffline.ts` chỉ còn là chỉ báo kết nối (`navigator.onLine` → Online/Offline + 1 toast dashboard). `SyncStatus.vue` chỉ hiển thị Online/Offline.
- Mọi read/write đi thẳng Supabase qua `web/composables/useDataService.ts` và Pinia stores.

### Pinia stores thực sự tồn tại
- `web/stores/task.store.ts` (id `'task'`, cloud Supabase trực tiếp; có luồng review + khóa focus).
- `web/stores/focus.store.ts` (Pomodoro timer).
- `web/stores/user.store.ts`.
- KHÔNG có: `sync.store`, `dashboard.store` (dashboard tính inline), `media.store` (admin/media dùng `useDataService`), `auth.store` (auth là composable `useAuth.ts` + Supabase Auth).

### Auth & duyệt user
- Supabase Auth email/password. Đăng ký → trigger `handle_new_user()` tạo `public.users` với `status='pending'` (admin auto `'approved'`).
- Duyệt user bằng cột `public.users.status` (pending|approved|rejected) + RLS `is_admin()`. Admin approve/reject/re-approve/set-pending = `UPDATE users.status` (`useAuth.ts`; UI `admin/users.vue` có mục Pending/Approved/Rejected).
- **Admin = CHỈ `public.users.role='admin'`** — ĐÃ GỠ env `ADMIN_EMAILS` (frontend không còn override qua email). Tài khoản phải có `role='admin'` trong DB mới vào được `/admin`. Ai được admin khi đăng ký = danh sách email hardcode trong trigger `handle_new_user()` (xem `00008`).
- `app.vue` gọi `syncSession()` lúc mở app → re-validate role/status với DB (bị demote/reject/hết hạn thì tự logout).
- ⚠️ **Config Supabase BẮT BUỘC: "Confirm email" phải TẮT** (Authentication → Providers → Email). Cổng chặn là admin-approval (`users.status`); nếu bật Confirm email thì user được duyệt vẫn kẹt lỗi *"Email not confirmed"*. (Xác nhận user cũ đang kẹt: `UPDATE auth.users SET email_confirmed_at=now() WHERE email_confirmed_at IS NULL;`)
- **ĐÃ GỠ luồng cũ (migration 00007):** bảng `public.user_requests`, edge function `supabase/functions/approve-user`, bảng `public.profiles` (chưa từng tồn tại). Tuyệt đối không mô tả/khôi phục các thành phần này.
- Migrations: `00001` schema · `00002`/`00004` seed admin · `00003` auth trigger · `00005` demo accounts (`admin@focusmode.app/admin123`, `user@focusmode.app/user123`) · `00006` users.status + is_admin() + RLS · `00007` drop legacy approval · `00008` đồng bộ admin list + backfill role='admin' · `00009` hardening DB (chặn tự đổi role/status bằng trigger, siết INSERT worklogs/stats, FK users→auth.users, drop sync_log, index users.status) · `00010` `tasks.completed_at` (mốc hoàn thành bất biến + trigger `set_task_completed_at` + index) → map worklog/thống kê/AI theo NGÀY HOÀN THÀNH, không theo `updated_at` · `00011` trigger `sync_user_email` đồng bộ `public.users.email` theo `auth.users.email` khi user đổi email (mirror cho admin list) · `00012` RPC `change_my_email()` — đổi email NGAY (không cần confirm; frontend gọi `supabase.rpc('change_my_email')` thay cho `auth.updateUser({email})` vốn bị pending ở một số project) · `00013` bảng `ambient_sounds` (nhạc nền Admin quản lý: name + S3 url + is_active + sort_order; RLS đọc-all cho authenticated, ghi cho `is_admin()`; trigger `updated_at`).
- **Trạng thái migration thực tế:** đã chạy tới `00008` (backfill profile). **`00009`, `00010`, `00011`, `00012`, `00013` CẦN được chạy** trong Supabase SQL Editor (`00009` FK + hardening; `00010` `completed_at`; `00011` trigger đồng bộ email; `00012` RPC `change_my_email`; `00013` bảng `ambient_sounds`). Sau `00009`: `sync_log` bị drop.

### DB tables (schema `public`)
`users` · `tasks` (status: pending|in_progress|completed|cancelled; priority 0–3; duration_spent; due_date; review; **completed_at** — mốc hoàn thành BẤT BIẾN, trigger giữ, dùng để map theo ngày) · `focus_sessions` (emotion_label, emotion_confidence, journal_text, duration_planned/actual, ambient_track) · `daily_worklogs` · `daily_stats` (chỉ `created_at`, KHÔNG có `updated_at`) · `media_library` (type CHECK **5 giá trị**: quote, sutra, video, article, audio; `embedding_vector VECTOR(384)`; index ivfflat cosine) · `ambient_sounds` (nhạc nền: name, url S3, is_active, sort_order; RLS đọc-all + ghi is_admin) · `sync_log` (đã drop ở 00009). Extensions: uuid-ossp, pgcrypto, vector. Functions: update_modified_column, search_similar_content, get_user_streak, is_admin, handle_new_user.

### Pages (`web/pages`)
`/` (landing, cloud-only — đã bỏ quảng cáo offline; có "Cloud Sync") · `/login` (Sign In / Request Access / Forgot) · `/dashboard` · `/tasks` · `/focus` · `/agent` · `/calendar` (History heatmap) · `/profile` · `/admin`, `/admin/users`, `/admin/media`, `/admin/ambient` · `/author`. Middleware: `auth` + `admin`.

### Tasks (hành vi UI)
- 3 section màu: **Pending (trắng/xám)**, **In Progress (đen/vàng)**, **Completed (trắng/xanh)**; đã bỏ tab "All".
- Tick hoàn thành → hiện hộp review **"How was this task?"** trước khi đánh dấu xong (luồng ở `task.store.ts` + component dùng chung `web/components/TaskReviewDialog.vue` đặt trong layout → chạy cả ở trang Tasks lẫn widget dashboard).
- CRUD Edit/Delete từng task. Task **Completed** → Edit chỉ sửa được `review`, các field khác khóa.
- Ô **Due date đã bỏ khỏi form tạo** (cột `due_date` vẫn giữ trong DB/model).
- Task tạo mới (tay + Agent) đều `status='pending'`.
- Tick bị **khóa 🔒** khi task đang gắn với phiên focus đang chạy/tạm dừng.

### Focus timer (hành vi hiện tại)
- Đếm ngược **neo theo mốc thời gian thực** (`endAt = Date.now()+duration`); chính xác kể cả khi tab chạy nền (tự hiệu chỉnh mỗi tick + listener `visibilitychange`).
- Pause/Resume; hết giờ → phát **chuông WebAudio + Notification trình duyệt** (xin quyền lúc Start; bấm thông báo để quay lại web), rồi Session Complete → journal → nhận diện cảm xúc → gợi ý nội dung → lưu phiên.
- CHỈ task `in_progress` mới gắn được vào phiên focus. Lưu snapshot `taskTitle` để hiển thị bền vững.
- **Nhạc nền (Ambient) — DB-driven (2026-07-08):** danh sách nhạc do Admin quản lý ở bảng `ambient_sounds` (trang `/admin/ambient`). `AmbientPlayer.vue` nạp track active → phát **file MP3 thật** từ S3 URL bằng `HTMLAudioElement` (loop + fade), thay cho nhạc synth WebAudio cũ. `focus_sessions.ambient_track` lưu URL track đã chọn.

### AI features (CHƯA hoàn chỉnh — cần `NUXT_PUBLIC_API_GATEWAY_URL`)
- **Agent chat**: `useAgentChat` → POST `{API}/agent/chat` → Lambda BFF → Bedrock Agent → action-handler lambda (CRUD task Supabase). Lambda `agent-bff` + `agent-action-handler` **CÓ code Python**. Chưa cấu hình URL → báo lỗi (không có mock).
- **Emotion**: `useEmotionDetector` gọi `/emotion` nếu có API, không thì fallback regex client. Lambda `emotion-detector` **chỉ README**.
- **RAG**: `useRAG` gọi `/rag` nếu có, không thì fallback hardcode. Lambda `rag-recommender` **chỉ README**. KB lưu trong Supabase (`media_library` + pgvector); `search_similar_content()`. Model `all-MiniLM-L6-v2` 384 chiều.
- **Report**: `useReportExport` gọi `/report` nếu có, không thì tải `.md` client. Lambda `report-generator` **chỉ README**.
- **Embedding**: `useDataService.generateEmbedding`/`generateAllEmbeddings` → `/embed`, `/embed-all`. Lambda `admin-vectorizer` **chỉ README**.

### AWS status
- **Bedrock Task Agent ĐÃ DEPLOY & LIVE (2026-07-08)** — chuỗi `POST /agent/chat` → `agent-bff` → Bedrock Agent → Action Group → `agent-action-handler` → Supabase `tasks`. ID thật: **agent `KKJCF9RAKJ`** · **alias `prod` = `K8YDCGJRW4`** (trỏ version 2, instruction ASCII sạch) · **guardrail `9l9zw1sh1tei` v1** (Prompt Attack HIGH + denied topics) · **action group `80WEPXLIJ8`** (todo-manager-api) · **model `global.anthropic.claude-haiku-4-5-20251001-v1:0`** (Claude **Haiku 4.5**, global cross-region inference profile — **50 RPM**, gấp 10× Sonnet 3.5 V2 apac=5 RPM). Chọn Haiku 4.5 vì quota cao nhất trong model account có access → **hết `throttlingException`** cho multi-turn; rẻ/nhanh, đủ cho task agent. **Finding quan trọng:** dùng **global** inference profile cho Agent cần agent service role có **`bedrock:GetInferenceProfile`** (+ `GetFoundationModel`) — KHÔNG chỉ `InvokeModel`; thiếu nó → `AccessDenied ... using InferenceProfile global.*` khi update-agent (đây là lý do trước đó tưởng global bị chặn). *(Lịch sử: Haiku 3 account không có access; Sonnet 3.5 v1/v2 apac chỉ 2/5 RPM.)* Nếu cần hơn 50 RPM: Service Quotas → Bedrock → "Global cross-region ... Claude Haiku 4.5 requests per minute". · agent service role `AmazonBedrockExecutionRoleForAgents_task` (đã thêm `s3:GetObject` để đọc action-group schema từ S3 lúc runtime) · lambda role `focus-ai-lambda-role`. Route trên HTTP API `ffepnb6gei` (integration `qaf0g6v`, route `r5uwuyl`); test không token → 401 (đúng). `agent-bff` code: auth in-Lambda Supabase-validate ES256 + sessionId namespace chống hijack + cap input + try/except+CORS. `agent-action-handler`: parse cả `requestBody` (fix bug P0 mất title/description) + fail-closed userId + whitelist field + delete 404 + apiPath passthrough. **Còn lại (frontend):** set `NUXT_PUBLIC_API_GATEWAY_URL=https://ffepnb6gei.execute-api.ap-southeast-1.amazonaws.com` (Amplify + `web/.env`) rồi test `/agent`. Runbook: **`aws/bedrock/DEPLOY-cmd.md`**; cập nhật sau này: **`aws/UPDATE-guide.md`**; các phát hiện/gotcha khi deploy (quota throttling, ES256, model access...): **`docs/bedrock-agent-findings.md`**.
- Lambda **ĐÃ DEPLOY & LIVE**: `ambient-audio-manager` (2026-07-08) — S3 presigned upload + ListObjectsV2 cho Ambient Sound. Đã tạo: bucket `focus-mode-ambient-audio` (public-read + CORS, 5 MP3), IAM role `ambient-audio-manager-role`, Lambda (python3.12), **API Gateway HTTP API** `ffepnb6gei` → endpoint `https://ffepnb6gei.execute-api.ap-southeast-1.amazonaws.com` (test GET/POST = 200). ⚠️ **Lambda Function URL `auth-type NONE` bị account trả 403** dù cấu hình đúng (không có org/SCP) → đã chuyển sang API Gateway. Quick-create HTTP API KHÔNG tự thêm quyền invoke → phải `add-permission` cho `apigateway.amazonaws.com` (nếu thiếu = HTTP 500). Presigned PUT phải ký bằng **endpoint regional** (`endpoint_url=https://s3.<region>.amazonaws.com` + virtual addressing) — endpoint global `s3.amazonaws.com` gây 301 redirect → browser upload "network error". **Bảo mật (ĐÃ bật admin-only):** API Gateway public nhưng Lambda tự xác thực trong `_authorize()` — **để Supabase validate token** (không tự verify chữ ký): lấy `sub` (decode payload), gọi `GET /rest/v1/users?id=eq.{sub}&select=id,role` **kèm token** → PostgREST verify token (mọi thuật toán) + RLS trả role; `role='admin'`→qua, sai/hết hạn→401, không phải admin→403. **Bật bằng env `SUPABASE_URL`+`SUPABASE_ANON_KEY`** (đã set); bỏ 2 biến này = public. `SUPABASE_JWT_SECRET` **không còn dùng** (thừa). **2 bug đã fix & document** (DEPLOY-cmd.md "Bug auth"): (1) token user là **ES256** không phải HS256 → không tự verify HS256 được; (2) admin đọc được nhiều dòng `users` (RLS) → phải lọc `?id=eq.{sub}` thay vì `rows[0]`. Runbook: `aws/lambdas/ambient-audio-manager/DEPLOY-cmd.md` (Bước 7 + Bug auth).
- Lambda **chỉ README (chưa code)**: `emotion-detector`, `rag-recommender`, `admin-vectorizer`, `report-generator` — **app vẫn chạy nhờ fallback client** (regex/hardcode/.md client). Kế hoạch implement chi tiết từng cái (dùng Bedrock để tránh ML layer): **`docs/ai-features-roadmap.md`**.
- Layers (`onnx-transformers`, `sentence-transformers`): chỉ spec. `aws/api-gateway/openapi.yaml` (đã thêm route `/ambient/*`; **authorizer trong spec KHÔNG dùng** — token ES256, auth in-Lambda) + `aws/bedrock/action-group-openapi.yaml`: có spec nhưng **CHƯA deploy**. IAM role JSON: `s3:ListBucket` trên `focus-mode-*`; `bedrock:InvokeAgent` scope `agent-alias/*` (đã sửa từ `agent/*`); đã bỏ `lambda:InvokeFunction` thừa. Chưa có CI/CD/IaC/WAF.
- **Chuẩn auth AWS (thống nhất):** token Supabase ký **ES256** → KHÔNG dùng JWT authorizer API Gateway (chỉ RS256). Mọi Lambda tự verify token in-Lambda: Bearer → decode sub → `GET /rest/v1/users?id=eq.{sub}` kèm token (PostgREST verify + RLS). Route admin thì Lambda check `role='admin'`. Frontend `useAgentChat.ts` đã sửa gửi `access_token` thật (trước gửi nhầm UUID) + bỏ `userId` khỏi body.

---

## 2. Đã làm trong giai đoạn này (changelog 2026-06-29)
1. **Fix focus timer**: đếm theo thời gian thực + chuông + Notification khi hết giờ (trước đây dùng `setInterval--` nên lệch khi đổi tab).
2. **Bug task gắn focus biến mất / "Task: None"**: lưu snapshot `taskTitle` vào focus store; hiển thị từ store.
3. **Khóa hoàn thành task** khi đang trong phiên focus (`isLockedByFocus` + `TaskLockedError`).
4. **CRUD task** (Edit/Delete) + dialog; bỏ ô Due date khỏi form (giữ cột DB).
5. **Review-on-complete dùng chung** ở mọi nơi (chuyển luồng vào `task.store` + `TaskReviewDialog.vue` trong layout).
6. **3 section màu** ở trang Tasks (bỏ "All"); **focus chỉ gắn task `in_progress`**.
7. **Task Completed** chỉ cho sửa `review`, khóa các field khác.
8. **Xác nhận**: Agent tạo task ở `status='pending'` (Lambda `agent-action-handler` hardcode).
9. **Dọn DB Phương án A**: migration `00007` drop `user_requests`; xóa edge function `approve-user`; cập nhật `00005` + `supabase/README.md`.
10. **media_type**: mở rộng frontend khớp DB (5 giá trị).
11. **Sửa marketing offline**: landing + dashboard không còn quảng cáo offline-first/IndexedDB.
12. **Đồng bộ toàn bộ `docs/`** với code (11 file kỹ thuật; giữ nguyên 2 file đề bài RFP/Supply theo yêu cầu).
13. **Tạo `Plan_and_Deploy.md`** (đủ §1–16: audit `aws/` + lộ trình deploy Amplify + lịch 2 tuần + diagram + PPT + test plan).
15. **Dashboard analytics (2026-07-06)**: thêm 4 chart nhẹ (SVG/CSS thuần, 0 lib) — Focus time 7 ngày, Tasks hoàn thành 7 ngày (theo `completed_at`), Task theo status (donut), Task đang mở theo priority. Component: `ChartBars.vue`, `ChartHBars.vue`, `ChartDonut.vue`; tính client-side từ tasks + focus_sessions.
14. **Rà & cải thiện tính năng local + DB (2026-07-05)**: sửa Ambient (phát audio thật bằng WebAudio + fix binding), verify mật khẩu cũ khi đổi, persist phiên focus qua reload + không mất journal khi save lỗi, khóa Delete task khi đang focus, sửa 3 lỗi stats dashboard (mood/tasks-done/streak), re-validate session lúc mở app (`syncSession`), thêm mục Rejected users, banner lỗi + Retry cho task list, Worklog gộp cả ngày chỉ có task. DB: migration `00009` hardening.
16. **Ambient Sound quản lý qua Admin (2026-07-08)**: trang `/admin/ambient` 2 phần — **Phần 1 S3 File Management** (upload MP3 lên S3 qua presigned URL + list file bucket, có Copy link / "Dùng ↓") dùng Lambda mới `ambient-audio-manager` (`POST /ambient/upload-url`, `GET /ambient/files`); **Phần 2 CRUD** bảng `ambient_sounds` = danh sách nhạc user thấy ở trang Focus. Đổi nhạc nền từ **synth → file MP3 thật** (`useAmbientSound` phát `HTMLAudioElement`, `AmbientPlayer` nạp từ DB). DB: migration `00013`. Frontend gọi backend qua biến riêng `NUXT_PUBLIC_AMBIENT_API_URL` (fallback `apiGatewayUrl`). **AWS backend ĐÃ DEPLOY & test 200** (bucket + Lambda + API Gateway `ffepnb6gei`, xem mục AWS status). **Còn lại để chạy production:** (1) chạy migration `00013` trong Supabase; (2) set `NUXT_PUBLIC_AMBIENT_API_URL=https://ffepnb6gei.execute-api.ap-southeast-1.amazonaws.com` trong env Amplify + redeploy (local `.env` đã set sẵn).
17. **Audit aws/ + hardening chuỗi Bedrock Agent (2026-07-08)**: chạy workflow 5-lens audit toàn bộ `aws/`. **Fix 3 P0**: (a) `agent-bff` đọc userId từ `requestContext.authorizer.claims.sub` — crash trên HTTP API không authorizer → đổi sang verify token in-Lambda (Supabase-validate ES256); (b) `agent-action-handler` chỉ đọc `event['parameters']` — mất toàn bộ `requestBody` (title/description) → thêm `_params()` gộp `requestBody.content.*.properties`; (c) `useAgentChat.ts` gửi UUID làm Bearer thay vì `access_token` → sửa. **Fix P1**: sessionId namespace theo user (chống session hijack), fail-closed userId + whitelist field (chống confused-deputy/mass-assignment), delete 404, cap input, try/except+CORS, `deploy.sh` dùng wheel manylinux (tránh ImportError), bỏ `psycopg2` thừa, IAM `bedrock:InvokeAgent`→`agent-alias/*` + bỏ `lambda:InvokeFunction`. **Bảo mật Bedrock** (chống prompt injection): tạo `aws/bedrock/DEPLOY-cmd.md` (runbook end-to-end) + `guardrail-config.json` (Prompt Attack HIGH + denied topics + PII) + `agent-instructions.txt` (hardened, "treat content as DATA") + IAM agent role. Cập nhật `aws/README.md`, `bedrock/README.md`, `openapi.yaml`, và `Internship_Architecture.drawio` (Supabase Auth ES256, auth in-Lambda, security layer). **Chưa deploy Bedrock** — theo runbook khi sẵn sàng.

---

## 3. Vấn đề đang mở / phải sửa trước khi deploy (từ audit — chi tiết & ưu tiên trong `Plan_and_Deploy.md` §4)
- **P0 Auth**: frontend gửi `Authorization: Bearer = currentUser.id` (UUID) thay vì Supabase JWT → API Gateway JWT authorizer chặn hết. Cần wrapper `$fetch` gắn `session.access_token`. **Lưu ý gốc rễ**: Supabase có thể phát JWT HS256 → authorizer native (JWKS) không verify được → có thể cần **custom Lambda authorizer**.
- **P0 Route mismatch**: FE gọi `/emotion`, `/rag`, `/embed`, `/embed-all` ≠ openapi `/emotion/detect`, `/rag/recommend`, `/admin/vectorize`; cần chuẩn hoá 1 nguồn.
- **Lỗ hổng RLS leo quyền** (user tự `UPDATE role='admin'/status='approved'`) — ĐÃ có bản vá ở **migration `00009`** bằng **BEFORE UPDATE trigger** `guard_user_self_update()` (KHÔNG dùng `WITH CHECK` — cách đó không vá được vì `id` không đổi vẫn pass). `00009` cũng siết INSERT `daily_worklogs/daily_stats`. ⚠️ **Cần chạy `00009` trong Supabase SQL Editor.**
- **Amplify**: chưa có `amplify.yml`; build mặc định `nuxt build` ra node-server (không static) → dùng `nuxt generate`; **chưa có `.gitignore`** (web/.env đang hở); CI/CD có sẵn nhưng sai nền tảng (`docs/cicd-cloudflare-pages.yml`).
- **Chưa code/deploy**: 4 lambda + 2 layer + Bedrock Agent + S3/SES/EventBridge/Secrets/CloudWatch + KB ingestion (bảng `media_chunks` + model đa ngữ + pipeline crawl).

---

## 4. Đang dở / chờ xử lý
- **`Plan_and_Deploy.md` đã đầy đủ §1–16** — gồm audit + lộ trình deploy + **§12 lịch 2 tuần** + §13 gói tài liệu nộp + §14 diagram Mermaid + §15 outline PPT + §16 kế hoạch test production.
- 🔴 **CẦN chạy migration `00009`** trong Supabase (vá RLS leo quyền + FK + drop sync_log). Xem §1/§3.
- Các **P0 hạ tầng AWS ở mục 3 (auth JWT, route mismatch) CHƯA áp dụng vào code** — thuộc track deploy; người dùng muốn review kế hoạch trước.
- **Backlog đã hoãn (đợt rà 2026-07-05 — toàn 🟢, không chặn gì):** `duration_spent` cộng dồn theo task · gom RLS admin về 1 nguồn `is_admin()` (00005 subquery vs 00006) · section "Cancelled" cho task · modal "New Task" chết ở dashboard · card System Health tĩnh · ESC/focus-trap cho modal · confirm khi Promote/Demote · đổi tên "Dominant Mood" · `maxlength` input · singleton phiên focus đa-tab · gộp seed 00002/00004.

---

## 5. Cách tiếp tục (cho phiên Claude mới)
**Đọc theo thứ tự:** file này (`docs/PROJECT_STATE.md`) → `Plan_and_Deploy.md` → tài liệu `docs/` liên quan tới việc đang làm.

**Nguyên tắc làm việc:** cloud-only (không offline); duyệt user qua `users.status`; khi đổi code thì cập nhật `docs/` + file này; trả lời người dùng bằng tiếng Việt, thuật ngữ kỹ thuật giữ tiếng Anh; xác minh tuyên bố bằng code (file:line) trước khi khẳng định.

**Bước kế tiếp:** (1) **Chạy `00009`** trong Supabase (+ đảm bảo đã **tắt "Confirm email"**). (2) Chọn hướng — **A)** làm nốt backlog polish (§4), hoặc **B)** bắt đầu track AWS deploy theo `Plan_and_Deploy.md` §12: áp P0 auth JWT + chuẩn hoá route → viết 4 lambda + layer → API Gateway/Bedrock → KB ingestion → Amplify → test end-to-end.

**Prompt mẫu để mở phiên mới:**
> "Đọc `docs/PROJECT_STATE.md` và `Plan_and_Deploy.md` để nắm trạng thái dự án Focus Mode App. Tóm tắt cho tôi: kiến trúc, việc đã xong, và scope đang dở. Hôm nay tiếp tục: [việc bạn muốn]. Trước khi sửa code, xác nhận trạng thái với tôi."
