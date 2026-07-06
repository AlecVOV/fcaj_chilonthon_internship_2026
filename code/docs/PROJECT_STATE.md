# PROJECT_STATE — Focus Mode App (đọc file này TRƯỚC)

> Bản "trạng thái chuẩn" (single source of truth) để bất kỳ ai — kể cả một phiên Claude mới — nắm toàn bộ project từ đầu tới hiện tại rồi tiếp tục phát triển. Cập nhật: **2026-07-06**.
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
- Migrations: `00001` schema · `00002`/`00004` seed admin · `00003` auth trigger · `00005` demo accounts (`admin@focusmode.app/admin123`, `user@focusmode.app/user123`) · `00006` users.status + is_admin() + RLS · `00007` drop legacy approval · `00008` đồng bộ admin list + backfill role='admin' · `00009` hardening DB (chặn tự đổi role/status bằng trigger, siết INSERT worklogs/stats, FK users→auth.users, drop sync_log, index users.status) · `00010` `tasks.completed_at` (mốc hoàn thành bất biến + trigger `set_task_completed_at` + index) → map worklog/thống kê/AI theo NGÀY HOÀN THÀNH, không theo `updated_at`.
- **Trạng thái migration thực tế:** đã chạy tới `00008` (backfill profile). **`00009` và `00010` CẦN được chạy** trong Supabase SQL Editor (`00009` tự `DELETE` dòng `public.users` mồ côi trước khi thêm FK; `00010` thêm `completed_at` + backfill từ `updated_at`). Sau `00009`: `sync_log` bị drop.

### DB tables (schema `public`)
`users` · `tasks` (status: pending|in_progress|completed|cancelled; priority 0–3; duration_spent; due_date; review; **completed_at** — mốc hoàn thành BẤT BIẾN, trigger giữ, dùng để map theo ngày) · `focus_sessions` (emotion_label, emotion_confidence, journal_text, duration_planned/actual, ambient_track) · `daily_worklogs` · `daily_stats` (chỉ `created_at`, KHÔNG có `updated_at`) · `media_library` (type CHECK **5 giá trị**: quote, sutra, video, article, audio; `embedding_vector VECTOR(384)`; index ivfflat cosine) · `sync_log`. Extensions: uuid-ossp, pgcrypto, vector. Functions: update_modified_column, search_similar_content, get_user_streak, is_admin, handle_new_user.

### Pages (`web/pages`)
`/` (landing, cloud-only — đã bỏ quảng cáo offline; có "Cloud Sync") · `/login` (Sign In / Request Access / Forgot) · `/dashboard` · `/tasks` · `/focus` · `/agent` · `/calendar` (History heatmap) · `/profile` · `/admin`, `/admin/users`, `/admin/media` · `/author`. Middleware: `auth` + `admin`.

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

### AI features (CHƯA hoàn chỉnh — cần `NUXT_PUBLIC_API_GATEWAY_URL`)
- **Agent chat**: `useAgentChat` → POST `{API}/agent/chat` → Lambda BFF → Bedrock Agent → action-handler lambda (CRUD task Supabase). Lambda `agent-bff` + `agent-action-handler` **CÓ code Python**. Chưa cấu hình URL → báo lỗi (không có mock).
- **Emotion**: `useEmotionDetector` gọi `/emotion` nếu có API, không thì fallback regex client. Lambda `emotion-detector` **chỉ README**.
- **RAG**: `useRAG` gọi `/rag` nếu có, không thì fallback hardcode. Lambda `rag-recommender` **chỉ README**. KB lưu trong Supabase (`media_library` + pgvector); `search_similar_content()`. Model `all-MiniLM-L6-v2` 384 chiều.
- **Report**: `useReportExport` gọi `/report` nếu có, không thì tải `.md` client. Lambda `report-generator` **chỉ README**.
- **Embedding**: `useDataService.generateEmbedding`/`generateAllEmbeddings` → `/embed`, `/embed-all`. Lambda `admin-vectorizer` **chỉ README**.

### AWS status
- Lambda **CÓ code**: `agent-bff`, `agent-action-handler`.
- Lambda **chỉ README**: `emotion-detector`, `rag-recommender`, `admin-vectorizer`, `report-generator` (+ `focus-ai-suggestions` spec-only).
- Layers (`onnx-transformers`, `sentence-transformers`): chỉ spec. `aws/api-gateway/openapi.yaml` + `aws/bedrock/action-group-openapi.yaml`: có spec nhưng **CHƯA deploy**. IAM role JSON có sẵn. Chưa có CI/CD/IaC.

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
14. **Rà & cải thiện tính năng local + DB (2026-07-05)**: sửa Ambient (phát audio thật bằng WebAudio + fix binding), verify mật khẩu cũ khi đổi, persist phiên focus qua reload + không mất journal khi save lỗi, khóa Delete task khi đang focus, sửa 3 lỗi stats dashboard (mood/tasks-done/streak), re-validate session lúc mở app (`syncSession`), thêm mục Rejected users, banner lỗi + Retry cho task list, Worklog gộp cả ngày chỉ có task. DB: migration `00009` hardening.

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
