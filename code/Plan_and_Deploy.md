# Plan_and_Deploy.md — Focus Mode App

> Tài liệu kiến trúc & kế hoạch triển khai. Cập nhật: 2026-06-29.
> Nguồn dữ kiện: audit findings + verification (ưu tiên verification corrections khi mâu thuẫn) + session changelog.

---

## Mục lục

1. [Tóm tắt điều hành](#1-tóm-tắt-điều-hành)
2. [Hiện trạng theo tầng](#2-hiện-trạng-theo-tầng)
3. [Đã hoàn thành trong giai đoạn này](#3-đã-hoàn-thành-trong-giai-đoạn-này)
4. [CẦN SỬA trước khi deploy (P0/P1)](#4-cần-sửa-trước-khi-deploy-p0p1)
5. [CẦN THÊM (build mới)](#5-cần-thêm-build-mới)
6. [CẦN XOÁ / DỌN](#6-cần-xoá--dọn)
7. [Lộ trình deploy theo thứ tự](#7-lộ-trình-deploy-theo-thứ-tự)
8. [Hướng dẫn deploy Amplify cho Nuxt SPA](#8-hướng-dẫn-deploy-amplify-cho-nuxt-spa)
9. [Cách nối từng component AI end-to-end](#9-cách-nối-từng-component-ai-end-to-end)
10. [Lưu ý khi deploy & giai đoạn tiếp theo](#10-lưu-ý-khi-deploy--giai-đoạn-tiếp-theo)
11. [Checklist pre-deploy](#11-checklist-pre-deploy)
12. [Lịch triển khai 2 tuần (10 ngày làm việc)](#12-lịch-triển-khai-2-tuần-10-ngày-làm-việc)
13. [Gói tài liệu nộp (Submission Package)](#13-gói-tài-liệu-nộp-submission-package)
14. [Sơ đồ kiến trúc & luồng (Mermaid)](#14-sơ-đồ-kiến-trúc--luồng-mermaid)
15. [Slide thuyết trình (Outline ~16–20 slide)](#15-slide-thuyết-trình-outline-1620-slide)
16. [Kế hoạch test production & tiêu chí nghiệm thu](#16-kế-hoạch-test-production--tiêu-chí-nghiệm-thu)

---

## 1. Tóm tắt điều hành

**Focus Mode App** là ứng dụng quản lý phiên tập trung (Pomodoro/Focus) kèm 5–6 tính năng AI: agent chat tạo/sửa task, nhận diện cảm xúc (emotion), gợi ý nội dung theo cảm xúc (RAG + Knowledge Base), xuất báo cáo (report), và sinh embedding cho thư viện nội dung (embedding/vectorize). Có thêm một tính năng spec-only thứ 6 là *AI Suggestions* (`focus-ai-suggestions`) hiện chỉ là chuỗi tĩnh ở client.

**Kiến trúc mục tiêu:**

```
[Browser]
  Nuxt SPA (Amplify Hosting, static)
      |  read/write trực tiếp (anon key + RLS)
      v
  Supabase (Postgres + Auth + pgvector)
      ^
      |  service_role (bypass RLS)
[AWS]
  API Gateway (JWT authorizer = Supabase JWT, CORS Amplify origin)
      |--> agent-bff  --> Bedrock Agent --> agent-action-handler --> Supabase (task CRUD)
      |--> emotion-detector   (chưa code)
      |--> rag-recommender    (chưa code) --> pgvector search_similar_chunks
      |--> report-generator   (chưa code) --> S3 + SES + EventBridge cron
      |--> admin-vectorizer/embed (chưa code) --> upsert embedding vào Supabase
```

**Mức độ sẵn sàng tổng thể: ~40%.**

| Khối | Sẵn sàng | Ghi chú |
|---|---|---|
| Frontend (app/DB logic) | ~85% | App chạy tốt cloud-only; còn bug auth/route ở lớp gọi AI |
| Supabase/DB | ~75% | Schema + pgvector OK; thiếu `media_chunks`, có lỗ hổng RLS escalation |
| AWS AI backend | ~20% | 2/6 lambda có code; còn lại README-only; chưa deploy hạ tầng |
| Amplify deploy | ~5% | Chưa có `amplify.yml`, chưa có `.gitignore`, build mode sai |

**Kết luận:** App SPA sẽ deploy và load được trên Amplify, nhưng **mọi tính năng AI sẽ fail (401 / 404 / fallback im lặng)** cho tới khi sửa auth + route và build 4 lambda còn thiếu.

---

## 2. Hiện trạng theo tầng

Chú thích: ✅ sẵn sàng · ⚠️ có nhưng lệch/thiếu · ❌ chưa có / hỏng.

| Tầng / Thành phần | Trạng thái | Ghi chú (file:line) |
|---|---|---|
| **Frontend — app & DB logic** | ✅ | Nuxt 3 (`package.json` nuxt ^3.15, dù gọi là "Nuxt 4"), cloud-only Supabase. Tasks/Focus/Calendar/Admin hoạt động. |
| **Frontend — build mode** | ⚠️ | Script mặc định `nuxt build` → `.output/server` (preset node-server), KHÔNG static. Phải dùng `nuxt generate`. (`web/package.json:8-9`; `.output/nitro.json`) |
| **Frontend — gọi AI (auth)** | ❌ | `useAgentChat` gửi `Bearer ${currentUser.id}` (UUID, không phải JWT) (`useAgentChat.ts:74`); 4 composable AI khác KHÔNG gửi header auth nào. |
| **Frontend — gọi AI (route)** | ❌ | FE gọi `/emotion`, `/rag`, `/embed`, `/embed-all` ≠ openapi `/emotion/detect`, `/rag/recommend`, `/admin/vectorize`; `/embed*` không tồn tại server-side. |
| **Frontend — admin identity** | ✅ | Đã BỎ hẳn `ADMIN_EMAILS`/`adminEmails` khỏi env + code; admin xác định DUY NHẤT bằng `public.users.role='admin'` (khớp RLS `is_admin()`). |
| **Supabase — schema** | ✅ | `users/tasks/focus_sessions/daily_worklogs/daily_stats/media_library/sync_log`; ext uuid-ossp, pgcrypto, vector. |
| **Supabase — pgvector RAG** | ⚠️ | `media_library.embedding_vector VECTOR(384)` + index ivfflat cosine + `search_similar_content()` (`00001:121-228`). Thiếu bảng `media_chunks`; model `all-MiniLM-L6-v2` yếu tiếng Việt. |
| **Supabase — RLS** | ❌ | Lỗ hổng: policy "Users update own profile" KHÔNG có `WITH CHECK` ⇒ user tự `UPDATE role='admin', status='approved'` để leo quyền (`00006:99-100`). `daily_worklogs/daily_stats` INSERT `WITH CHECK (TRUE)` cho mọi role (`00001:281-288`). Policy admin định nghĩa trùng/mâu thuẫn (`00001:291-300` email-LIKE vs `rls_policies.sql:29-34` role). |
| **Lambda `agent-bff`** | ⚠️ | CÓ code (`lambda_function.py:1-41`). Đọc `claims.sub` (REST v1 shape) — cần verify theo loại API Gateway. Không error-handling, chỉ trả `{sessionId,responseText}` (thiếu tasks/followUpQuestions FE đang đọc). CORS chỉ trên path 200. |
| **Lambda `agent-action-handler`** | ✅ | CÓ code (`lambda_function.py:1-67`). Route `/create-task`,`/update-task`,`/delete-task` theo apiPath+method; khớp action-group openapi. `create` tin `user_id` truyền vào. |
| **Lambda `emotion-detector`** | ❌ | CHỈ README. Cần distilbert ONNX INT8 + layer onnx-transformers. |
| **Lambda `rag-recommender`** | ❌ | CHỈ README. pgvector cosine; chưa định nghĩa nguồn query vector. |
| **Lambda `admin-vectorizer` (embed)** | ❌ | CHỈ README. all-MiniLM-L6-v2 384d + layer sentence-transformers. |
| **Lambda `report-generator`** | ❌ | CHỈ README. Contract drift 3 chiều (FE md_content vs README Pandoc vs spec LaTeX/Tectonic). |
| **Lambda `focus-ai-suggestions`** | ❌ | Spec-only, không có thư mục/code; "AI Suggestions" trong report là chuỗi tĩnh client. |
| **API Gateway** | ⚠️ | `openapi.yaml` định nghĩa 5 route + JWT authorizer (issuer Supabase `/auth/v1`, audience `authenticated`) nhưng CHƯA deploy. Không có OPTIONS/CORS. Loại API (REST v1 vs HTTP v2) chưa pin ⇒ chưa xác định được `claims.sub` hay `jwt.claims.sub`. |
| **Bedrock** | ⚠️ | Agent + Action Group + alias chỉ documented (`aws/bedrock/README.md`), chưa tạo. Chưa có bước request model access theo region. |
| **IAM** | ⚠️ | Role có logs/s3(focus-mode-*)/ses/bedrock:InvokeAgent/secretsmanager. THIẾU `bedrock:InvokeModel`, `bedrock:Retrieve*`; `lambda:InvokeFunction` scope `focus-*` KHÔNG khớp tên `agent-bff`/`agent-action-handler`. SES & secretsmanager cấp nhưng chưa dùng. |
| **Layers** | ❌ | Chỉ spec. sentence-transformers (~200MB) + torch dễ vượt giới hạn 250MB unzip. Không có bước ship model weights lên `/opt/model`. |
| **S3 / SES** | ❌ | Chưa tạo bucket (`focus-mode-reports`?), chưa quyết public vs presigned URL. SES còn sandbox, sender chưa verify. **Lưu ý KB:** RAG dùng pgvector trong Supabase, KHÔNG cần S3; S3 chỉ phục vụ report/audio. |
| **EventBridge** | ❌ | cron `59 16 * * ? *` chỉ ghi trong README; chưa có rule/target/permission. |
| **Secrets Manager** | ❌ | IAM cấp `GetSecretValue` nhưng lambda đọc `os.environ` (service_role plaintext). |
| **CloudWatch / Observability** | ❌ | Không có alarm, log retention, X-Ray, DLQ, access log. |
| **CI/CD** | ❌ | Không có. File `docs/cicd-cloudflare-pages.yml` là GitLab CI cho Cloudflare/Netlify (sai platform), dùng pnpm/dist/, tham chiếu dir & SAM template không tồn tại ⇒ không dùng được. Chỉ có `deploy.sh` lẻ cho 2 lambda. |

---

## 3. Đã hoàn thành trong giai đoạn này

Tầng app/DB đã được dọn và bổ sung trong phiên làm việc này:

- **Gỡ offline-first hoàn toàn** → cloud-only Supabase. Đã xóa `web/lib/db.ts`, `web/composables/useSyncQueue.ts`, cờ `NUXT_PUBLIC_USE_MOCK_BACKEND`, mọi mock/OTP in-memory. `useOffline.ts` chỉ còn báo `navigator.onLine`; `SyncStatus.vue` chỉ hiển thị Online/Offline.
- **Gỡ luồng duyệt user cũ** (migration `00007`): bỏ `user_requests`, edge function `approve-user`, ý niệm `profiles`. Duyệt user nay qua cột `public.users.status` (pending|approved|rejected) + `is_admin()`; admin approve/reject = `UPDATE users.status`.
- **`media_type` mở rộng 5 giá trị** (quote, sutra, video, article, audio); frontend khớp DB CHECK.
- **Focus timer:** đếm neo theo `endAt` (chính xác qua tab nền, tự hiệu chỉnh + `visibilitychange`); hết giờ phát chuông WebAudio + Notification trình duyệt; chỉ task `in_progress` mới gắn được phiên focus; khóa hoàn thành task khi đang focus; lưu snapshot `taskTitle`.
- **Tasks:** 3 section màu Pending/In Progress/Completed (bỏ "All"); review-on-complete qua `TaskReviewDialog.vue` dùng chung trong layout (chạy ở cả Tasks lẫn widget dashboard); CRUD Edit/Delete; task Completed chỉ sửa được review; bỏ ô Due date khỏi form (giữ cột DB); task mới (tay + Agent) đều `pending`.
- **Toàn bộ `docs/` đã đồng bộ** 2026-06-29.
- **Phát hiện đã ghi nhận:** route openapi lệch route frontend; `agent-bff` nhận `Bearer = userId` thay vì JWT.
- **Quyết định KB:** lưu trong Supabase (`media_library` + pgvector), KHÔNG cần S3; quy mô <10 user pgvector thừa sức. Cần chunk + model embedding đa ngữ 384 chiều cho lời dạy tiếng Việt (vd Khangser Rinpoche / Dipkar).

---

## 4. CẦN SỬA trước khi deploy (P0/P1)

> Đây là các blocker. Nếu không sửa, mọi tính năng AI sẽ 401/404 hoặc fallback im lặng (che lỗi).

### P0 — Auth: thay `Bearer = userId` bằng Supabase JWT thật

- **Vấn đề:** `useAgentChat` gửi `Authorization: Bearer ${currentUser.id}` (UUID), 4 composable còn lại không gửi header. API Gateway có JWT authorizer ⇒ tất cả 401.
- **Fix:** tạo wrapper `$fetch` dùng chung (vd `web/composables/useApi.ts`) lấy token qua `getSupabase().auth.getSession()` rồi gắn `Authorization: Bearer ${session.access_token}` cho **cả 5** lệnh gọi AI.
- **Phụ thuộc / lưu ý quan trọng (verification):** phải xác nhận **cơ chế JWT của Supabase tương thích với authorizer**. API Gateway native JWT authorizer validate qua JWKS/OIDC; nếu Supabase phát token HS256 (shared secret) thì authorizer native KHÔNG verify được ⇒ cần **custom Lambda authorizer** verify bằng `SUPABASE_JWT_SECRET`. Quyết định việc này trước khi viết wrapper.
- Refs: `useAgentChat.ts:73-75`, `openapi.yaml:148-158`, `agent-bff/lambda_function.py:14`.

### P0 — Route mismatch: chuẩn hoá path FE ↔ openapi ↔ lambda

- **Vấn đề:** 3 artifact bất đồng; `/embed`, `/embed-all` không có server-side. (verification: `/agent/chat` và `/report` đã khớp PATH; `/report` chỉ lệch BODY.)
- **Fix:** chốt MỘT bộ route chuẩn duy nhất và cập nhật đồng thời FE + openapi + lambda README. Đề xuất:

| Tính năng | Route chuẩn | Method | Body | Response |
|---|---|---|---|---|
| Agent chat | `/agent/chat` | POST | `{sessionId, inputText}` | `{sessionId, responseText, tasks?, followUpQuestions?, actionTaken?}` |
| Emotion | `/emotion` | POST | `{text}` | `{label, confidence}` |
| RAG | `/rag` | POST | `{emotion, limit}` | `[{id,title,source,type,...}]` |
| Report | `/report` | POST | `{md_content, user_id, date}` | `{markdown_url, pdf_url, message}` |
| Embed (1) | `/embed` | POST | `{mediaId}` | `{ok}` |
| Embed (batch) | `/embed-all` | POST | `{}` | `{count}` |

  (Có thể chọn ngược lại — đổi FE theo openapi — miễn là MỘT nguồn sự thật; tránh giữ cả `/embed*` lẫn `/admin/vectorize`.)
- Refs: `useEmotionDetector.ts:15`, `useRAG.ts:8`, `useDataService.ts:161,165`, `openapi.yaml:46,104,124`.

### P0 — Body contract `/report` (3-way drift)

- **Vấn đề:** FE gửi `{md_content,user_id,date}`; openapi khai `{user_id,date,send_email}`; README/spec re-render từ DB (Pandoc/LaTeX-Tectonic). Lỗi 401 hiện bị fallback `.md` client che (`useReportExport.ts:188`).
- **Fix:** chốt 1 nguồn — hoặc lambda nhận `md_content` client; hoặc FE bỏ `md_content` và lambda dựng từ DB — rồi sửa openapi khớp.

### P0 — Lỗ hổng RLS leo quyền (bảo mật, verification correction)

- **Vấn đề:** policy `Users update own profile` (`00006:99-100`) không có `WITH CHECK` ⇒ user tự đặt `role='admin', status='approved'`.
- **Fix:** thêm `WITH CHECK` cấm đổi `role`/`status` (hoặc chuyển 2 cột này sang admin-only / trigger). Đây là blocker an ninh vì RLS là biên giới duy nhất (route client ssr:false).
- Đồng thời: siết `daily_worklogs/daily_stats` INSERT về `auth.role()='service_role'`; gộp 1 bộ RLS admin theo `is_admin()`/`role='admin'`.

### P1 — Secret service-role chỉ ở Lambda + chuyển sang Secrets Manager

- FE đúng (chỉ dùng anon key). Nhưng lambda đọc `SUPABASE_SERVICE_ROLE_KEY` từ `os.environ` (plaintext) dù IAM đã cấp `GetSecretValue`. Chuyển sang đọc Secrets Manager lúc cold start.

### P1 — CORS Amplify ↔ API Gateway

- Hiện chỉ `agent-bff` đặt `ACAO:*` trên path 200; không có OPTIONS preflight. Thêm CORS cấp gateway (allowOrigins = domain Amplify, allowHeaders `Authorization,Content-Type`, allowMethods `POST,OPTIONS`) và đặt CORS trên MỌI path (kể cả lỗi 4xx/5xx).

### P1 — `agent-bff` hardening & claim shape

- Bọc `try/except` quanh `json.loads(event['body'])` & `body['inputText']`; trả CORS trên mọi path.
- Pin loại API Gateway rồi sửa claim path đúng (`claims.sub` cho REST/format 1.0 vs `jwt.claims.sub` cho HTTP v2/format 2.0).
- Sửa IAM `lambda:InvokeFunction` để khớp tên hàm thật (hoặc đổi tên hàm sang `focus-*`).

---

## 5. CẦN THÊM (build mới)

| # | Hạng mục | Effort | Phụ thuộc |
|---|---|---|---|
| A1 | **Lambda `emotion-detector`** (`{text}`→`{label,confidence}`), distilbert ONNX INT8 | M | Layer onnx-transformers + model weights; route `/emotion` |
| A2 | **Lambda `rag-recommender`** (`{emotion,limit}`→`[{id,title,source,...}]`), pgvector cosine, map emotion→reference vector | M | Bảng `media_chunks` + model embedding chung; route `/rag` |
| A3 | **Lambda `admin-vectorizer`/embed** (`/embed` by mediaId, `/embed-all` batch→`{count}`) | M | Layer sentence-transformers; route `/embed*` |
| A4 | **Lambda `report-generator`** (`{md_content,user_id,date}`→`{markdown_url,pdf_url,message}`), S3 upload + Pandoc/PDF + SES | L | S3 bucket, SES verify, EventBridge, chốt contract |
| A5 | **(tùy chọn) `focus-ai-suggestions`** thay chuỗi tĩnh | M | Bedrock InvokeModel; EventBridge weekly |
| B1 | **Layer onnx-transformers** (~120MB) + ship ONNX weights lên `/opt/model` | M | — |
| B2 | **Layer sentence-transformers** (~200MB) — rủi ro vượt 250MB; cân nhắc **container-image Lambda** hoặc tải weights từ S3/EFS | M | — |
| C1 | **Bedrock Agent + Action Group + alias `prod`** + resource policy cho Bedrock gọi action-handler | M | Request model access (Claude 3 Haiku) theo region |
| C2 | **Request model access** trong Bedrock console theo region (`ap-southeast-1` có thể hạn chế; cân nhắc `us-east-1`) | S | — (lead-time) |
| D1 | **S3 buckets** (`focus-mode-reports`, `focus-mode-audio`) + chốt public-read vs presigned URL + bucket policy | S | IAM s3 bucket-level ARN |
| D2 | **SES**: verify domain/sender (DKIM/SPF) + **xin thoát sandbox** | S | Lead-time 24–48h AWS |
| D3 | **EventBridge** rule `cron(59 16 * * ? *)` → `report-generator` + `lambda:AddPermission` cho `events.amazonaws.com` + DLQ | M | A4 |
| D4 | **Secrets Manager** secret `focus-mode/*` (service_role key + JWT secret) + đọc lúc cold start | M | — |
| D5 | **CloudWatch**: log retention, alarm (errors/throttles/5xx), API GW access log, X-Ray | M | — |
| E1 | **Bảng `public.media_chunks`** (id, media_id FK→media_library ON DELETE CASCADE, chunk_index, content_text, embedding_vector VECTOR(384), token_count, created_at) + index ivfflat + index media_id | M | — |
| E2 | **Hàm `search_similar_chunks(...)`** join `media_chunks`↔`media_library` lấy title/source | M | E1 |
| E3 | **Đổi model embedding sang `paraphrase-multilingual-MiniLM-L12-v2`** (vẫn 384d) + re-embed toàn bộ + cột `language`, `model_name/version` | M | A3, E1; query & stored embedding PHẢI cùng model/normalize |
| E4 | **Pipeline ingest KB**: crawl (vd Dipkar/Khangser Rinpoche) → clean → chunk → embed → upsert `media_chunks`; `/embed-all` backfill media chưa có vector | L | A3, E1–E3; lưu ý bản quyền |
| F1 | **`amplify.yml`** + SPA redirect 200 → `/index.html` + inject env (mục 8) | S | — |
| F2 | **`.gitignore`** (web/.env, .nuxt, .output, node_modules) | S | — — làm NGAY trước mọi commit |
| F3 | **Top-level `aws/lambdas/README.md`** index 6 hàm + thứ tự build/deploy | S | — |

---

## 6. CẦN XOÁ / DỌN

| Hạng mục | Lý do | Ref |
|---|---|---|
| Comment `// JWT from auth` cạnh `Bearer ${currentUser.id}` | Sai ngữ nghĩa, che bug auth | `useAgentChat.ts:74` |
| `userId` trong body `/agent/chat` | Lambda lấy id từ claims; openapi không khai userId ⇒ dead weight | `useAgentChat.ts:71` |
| `catch{}` im lặng trong `useRAG` (và pattern fallback ở emotion/report) | Nuốt lỗi backend thật, ẩn regression khi tích hợp | `useRAG.ts:13-18` |
| Một trong hai contract embedding (`/embed*` **hoặc** `/admin/vectorize`) | Tránh 2 contract mâu thuẫn cho cùng tác vụ | `useDataService.ts:159-167`, `openapi.yaml:124-146` |
| `docs/cicd-cloudflare-pages.yml` | GitLab/Cloudflare/pnpm/dist — sai platform & out-of-sync; viết lại CI cho Amplify/AWS | — |
| `architecture.md` (nếu là transcript chat) | Không phải design artifact; gây hiểu nhầm là canonical | `architecture.md:1-95` |
| Seed admin trùng `00002` & `00004` | Gần như giống hệt; gộp 1 file | `00002:7-16`, `00004:14-21` |
| `00005_seed_demo_accounts.sql` (credentials cứng admin123/user123) | Backdoor nếu chạy trên prod; gate sau cờ non-prod hoặc xóa | `00005:7-8,63,111` |
| Per-lambda `ACAO:*` (sau khi bật CORS gateway) | Trùng/không scope; xung đột với CORS gateway | `agent-bff/lambda_function.py:35` |
| Stale `.output/server`, `.nuxt` trong working tree | Artifact SSR cũ gây nhiễu static deploy; gitignore + regenerate | `.output/nitro.json` |
| Quyền IAM `secretsmanager` thừa (nếu KHÔNG migrate) | Least-privilege; nhưng nên migrate (D4) thay vì xóa | `lambda-execution-role.json:36-42` |

---

## 7. Lộ trình deploy theo thứ tự

> Mỗi bước phụ thuộc bước trước. Các bước lead-time (model access, SES sandbox) khởi động SỚM song song.

**Giai đoạn 0 — Tiền điều kiện (chạy sớm, song song)**
1. Bedrock: **request model access** (Claude 3 Haiku) tại region chọn (cân nhắc `us-east-1`). [lead-time]
2. SES: **verify domain/sender** + xin **thoát sandbox**. [lead-time 24–48h]
3. Tạo `.gitignore` (F2) NGAY để tránh commit `web/.env`.

**Giai đoạn 1 — Supabase / DB**
4. Sửa RLS leo quyền + siết worklog/stats INSERT + gộp policy admin (mục 4 P0).
5. Tạo `media_chunks` (E1) + `search_similar_chunks` (E2) + cột `language`/`model_name`.
6. Dọn seed trùng + gate demo accounts (mục 6).

**Giai đoạn 2 — Secrets & IAM**
7. Tạo secret `focus-mode/*` (service_role + JWT secret) trong Secrets Manager (D4).
8. Cập nhật IAM role: thêm `bedrock:InvokeModel`, `bedrock:Retrieve*`, s3 bucket-level + DeleteObject/ListBucket; sửa scope `lambda:InvokeFunction` khớp tên hàm.

**Giai đoạn 3 — Layers**
9. Build/publish layer onnx-transformers (B1) + ship ONNX weights.
10. Build sentence-transformers (B2) — nếu vượt 250MB chuyển sang container-image Lambda.

**Giai đoạn 4 — Lambdas**
11. Viết & deploy `emotion-detector`, `rag-recommender`, `admin-vectorizer/embed`, `report-generator` (A1–A4). Lưu ý: `deploy.sh` hiện chỉ `update-function-code` — lần đầu phải `create-function`.
12. Sửa `agent-bff` (hardening + claim shape + CORS) + đổi response thêm tasks/followUpQuestions nếu giữ UI giàu.

**Giai đoạn 5 — S3 / SES / EventBridge**
13. Tạo S3 buckets (D1). 14. Tạo EventBridge cron + permission + DLQ (D3).

**Giai đoạn 6 — API Gateway**
15. Deploy API Gateway theo openapi đã chuẩn hoá route (mục 4) — **pin loại API** (khuyến nghị HTTP API v2). Cấu hình JWT authorizer (hoặc custom Lambda authorizer nếu Supabase HS256). Bật CORS scoped domain Amplify + OPTIONS.
16. Smoke-test từng route bằng `curl` với access_token thật (chưa qua FE).

**Giai đoạn 7 — Bedrock**
17. Tạo Bedrock Agent (Claude 3 Haiku) + Action Group `todo-manager-api` (từ action-group-openapi) + alias `prod` + resource policy. Set `BEDROCK_AGENT_ID/ALIAS_ID` cho `agent-bff`.

**Giai đoạn 8 — Frontend wiring**
18. Sửa FE: wrapper `$fetch` gắn JWT cho cả 5 call; chuẩn hoá route/body; bỏ comment/userId thừa.
19. Đổi build sang `nuxt generate`; verify không có code SSR-only.

**Giai đoạn 9 — Amplify**
20. Thêm `amplify.yml` (mục 8); set app root = `web/`; baseDirectory `web/.output/public`.
21. Inject env `NUXT_PUBLIC_SUPABASE_URL/ANON_KEY/API_GATEWAY_URL/APP_URL` (build-time).
22. Thêm redirect 200 → `/index.html` (SPA deep-link).
23. Cấu hình custom domain + HTTPS; đặt Supabase Auth Site/Redirect URL = domain Amplify; `NUXT_PUBLIC_APP_URL` = domain thật.

**Giai đoạn 10 — Smoke test end-to-end**
24. Test lần lượt: agent chat (tạo/sửa/xóa task) → emotion → RAG (cần KB đã ingest) → report (S3 + email) → embed/embed-all → suggestions.

---

## 8. Hướng dẫn deploy Amplify cho Nuxt SPA

App nằm trong `web/` (monorepo subfolder), build **static** bằng `nuxt generate` → `web/.output/public`.

**`amplify.yml` mẫu** (đặt ở repo root):

```yaml
version: 1
applications:
  - appRoot: web
    frontend:
      phases:
        preBuild:
          commands:
            - npm ci
        build:
          commands:
            - npm run generate
      artifacts:
        baseDirectory: .output/public
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
          - .nuxt/**/*
```

> `baseDirectory` tương đối theo `appRoot` (`web/`) ⇒ trỏ `.output/public` (KHÔNG phải `dist/`).

**SPA redirect (Amplify Console → Rewrites and redirects):** thêm rule 200-rewrite để deep-link (`/admin/users`, `/focus`, …) không 404 khi refresh:

| Source | Target | Type |
|---|---|---|
| `</^[^.]+$\|\.(?!css\|js\|png\|jpg\|svg\|ico\|json\|woff2?)$).*/>` | `/index.html` | 200 (Rewrite) |

**Environment variables (Amplify Console → Environment variables — build-time, vì `runtimeConfig.public` được inline lúc build):**

```
NUXT_PUBLIC_SUPABASE_URL       = https://<project>.supabase.co
NUXT_PUBLIC_SUPABASE_ANON_KEY  = <anon key>
NUXT_PUBLIC_API_GATEWAY_URL    = https://<api-id>.execute-api.<region>.amazonaws.com/<stage>
NUXT_PUBLIC_APP_URL            = https://<amplify-domain>
```

**Lưu ý:**
- `supabaseClient.ts` mặc định về `localhost:54321`/`mock-key` nếu thiếu env ⇒ thêm fail-fast khi thiếu `NUXT_PUBLIC_SUPABASE_*` ở production.
- KHÔNG để Amplify auto-detect chạy `npm run build` (preset node-server) — phải pin `npm run generate`.
- Admin xác định bằng `public.users.role` + RLS `is_admin()` — KHÔNG còn env `ADMIN_EMAILS` (đã gỡ). Gating client không phải biên giới an ninh; nguồn sự thật là DB role.

---

## 9. Cách nối từng component AI end-to-end

Mọi call đi qua wrapper `$fetch` gắn `Authorization: Bearer <session.access_token>` (Supabase JWT).

### 9.1 Agent chat
- **Luồng:** `AgentChat.vue` → `useAgentChat` → `POST {API}/agent/chat {sessionId,inputText}` → API GW (JWT authorizer) → `agent-bff` (đọc user từ claims) → `bedrock_agent_runtime.invoke_agent` → Bedrock Agent → Action Group → `agent-action-handler` (apiPath create/update/delete) → Supabase task CRUD (service_role) → trả `{sessionId,responseText, tasks?, followUpQuestions?, actionTaken?}`.
- **Env:** `agent-bff`: `BEDROCK_AGENT_ID`, `BEDROCK_AGENT_ALIAS_ID`. `agent-action-handler`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (→ Secrets Manager).
- **Cần:** sửa response để FE đọc được tasks/followUpQuestions (hiện luôn undefined).

### 9.2 Emotion
- **Luồng:** `focus.vue` (debounce journalText) → `useEmotionDetector` → `POST {API}/emotion {text}` → `emotion-detector` (ONNX distilbert) → `{label,confidence}`. Thiếu API ⇒ fallback regex client.
- **Env:** `MODEL_PATH=/opt/model/...`, `TOKENIZER_PATH=/opt/model` (layer + weights), `SUPABASE_*` nếu lưu lại.
- **Nhãn:** focused, stressed, exhausted, relaxed, unmotivated.

### 9.3 RAG (KB recommendation)
- **Luồng:** `focus.vue` → `useRAG` → `POST {API}/rag {emotion,limit}` → `rag-recommender` → embed query (CÙNG model với stored) → `search_similar_chunks()` trên `media_chunks`/`media_library` (pgvector cosine) → `[{id,title,source,type,...}]`.
- **Env:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, model embedding 384d đa ngữ.
- **Điều kiện hoạt động:** KB phải đã được ingest + embed (E4); nếu `media_library`/`media_chunks` trống hoặc `embedding_vector NULL` ⇒ RAG luôn rỗng.

### 9.4 Report
- **Luồng:** `ExportReportButton.vue` → `useReportExport` → `POST {API}/report {md_content,user_id,date}` → `report-generator` → upload Markdown lên S3 (+ optional Pandoc→PDF) → SES email → `{markdown_url,pdf_url,message}`. Thiếu API ⇒ fallback tải `.md` client.
- **Env:** `SUPABASE_*`, `S3_BUCKET=focus-mode-reports`, `SES_SENDER_EMAIL` (đã verify).
- **EventBridge:** cron tối tạo report cho toàn user (cần nhánh "all users" trong code).
- **Cần:** chốt 1 nguồn render (client md_content vs DB) trước khi code.

### 9.5 Embedding / Vectorize
- **Luồng:** `admin/media.vue` → `useDataService.generateEmbedding {mediaId}` → `POST {API}/embed`; `generateAllEmbeddings` → `POST {API}/embed-all` → `{count}`. Lambda nạp content từ `media_library` theo id, embed (sentence-transformers 384d đa ngữ), upsert `embedding_vector`/`media_chunks`.
- **Env:** `SUPABASE_*`, layer sentence-transformers.
- **Cần:** thêm admin-role check (JWT đơn thuần không phải admin gate).

---

## 10. Lưu ý khi deploy & giai đoạn tiếp theo

### Bảo mật / Secret
- **RLS là biên giới duy nhất** (route ssr:false) — phải vá lỗ hổng leo quyền role/status trước khi mở đăng ký công khai.
- service_role bypass toàn bộ RLS ⇒ chỉ ở Lambda, ưu tiên Secrets Manager, không log.
- Anon key thấp rủi ro nhưng project URL không nên public ⇒ `.gitignore`. (`ADMIN_EMAILS` đã được gỡ khỏi client — admin nay chỉ theo `users.role` trong DB.)
- Xóa/gate demo credentials (`00005`).

### Free-tier & chi phí
- **Bedrock KHÔNG free-tier** (tính theo token) — nguồn chi phí bất ngờ lớn nhất.
- psycopg2 → Supabase Postgres qua VPC/NAT có thể phát sinh phí; nếu Supabase dùng REST client (supabase-py) thì tránh được NAT.
- ONNX/sentence-transformers Lambda 512–1024MB + cold start dài ăn nhanh 400k GB-s free.
- CloudWatch log không đặt retention = chi phí tăng dần. S3/SES/data-transfer cũng tích lũy.
- KB pgvector ở Supabase (không S3) là lựa chọn tiết kiệm cho quy mô <10 user.

### Observability / Logging
- Đặt log retention, alarm (errors/throttles/5xx), API GW access log, X-Ray cho chuỗi agent→action-handler→Supabase, DLQ cho EventBridge async. Không có ⇒ lỗi 401/500 vô hình trên prod.

### CI/CD (gợi ý)
- Viết lại pipeline cho đúng platform: **GitHub Actions** (repo là GitHub, dùng npm + `.output/`).
- IaC cho AWS: **SAM** hoặc **Terraform/CDK** thay cho `deploy.sh` lẻ — quản lý lambda + layer + API GW + IAM + EventBridge nhất quán; `create-function` lần đầu.

### Test
- Smoke test từng route bằng `curl` + access_token trước khi nối FE.
- Unit test contract (route/body/response) để chống drift tái diễn.

### Bản quyền dữ liệu cào
- Crawl lời dạy (Dipkar / Khangser Rinpoche…) phải kiểm tra license/điều khoản; lưu nguồn (`source`) + có cơ chế gỡ nội dung.

### Đa ngôn ngữ embedding
- Chuyển sang `paraphrase-multilingual-MiniLM-L12-v2` (giữ 384d ⇒ không đổi schema). Query & stored PHẢI cùng model + normalize, nếu không cosine vô nghĩa. Lưu `model_name/version` + `language` để không trộn vector khác model. ivfflat `lists=100` không hợp khi dữ liệu ít ⇒ cân nhắc hnsw / giảm lists / `ANALYZE` sau ingest.

### Rủi ro & giảm thiểu (tóm tắt)
| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Toàn bộ AI 401 trên prod (JWT/UUID) | Critical | Wrapper JWT + xác nhận cơ chế authorizer |
| RLS leo quyền role/status | Critical | `WITH CHECK` cấm đổi role/status |
| 4/6 lambda chưa code | High | Build theo lộ trình GĐ4 |
| Route/body drift | High | 1 bảng contract chuẩn, cập nhật đồng thời |
| Layer >250MB | High | Container-image Lambda / weights từ S3 |
| service_role plaintext | High | Secrets Manager |
| RAG rỗng (KB chưa ingest) | Med | Pipeline ingest + seed KB |
| Bedrock model access region | Med | Request access sớm; cân nhắc us-east-1 |
| SES sandbox | Med | Verify + thoát sandbox sớm |
| Fallback im lặng che lỗi | Med | Log/surface lỗi trước khi fallback |

---

## 11. Checklist pre-deploy

**Bảo mật / DB**
- [ ] Vá RLS `Users update own profile` (cấm đổi role/status) (`00006:99-100`)
- [ ] Siết `daily_worklogs`/`daily_stats` INSERT về `service_role`
- [ ] Gộp 1 bộ RLS admin (`is_admin()` / `role='admin'`)
- [ ] Tạo `.gitignore` (web/.env, .nuxt, .output, node_modules) trước mọi commit
- [ ] Gate/xóa demo credentials (`00005`)
- [ ] service_role + JWT secret vào Secrets Manager

**Contract / Auth**
- [ ] Wrapper `$fetch` gắn Supabase JWT cho cả 5 call AI
- [ ] Xác nhận cơ chế authorizer (native JWKS vs custom Lambda HS256)
- [ ] Chuẩn hoá route FE ↔ openapi ↔ lambda (1 bảng)
- [ ] Chốt body `/report` (1 nguồn render) + cập nhật openapi
- [ ] Bỏ comment "JWT from auth" + `userId` thừa trong body
- [ ] Pin loại API Gateway + sửa claim path trong `agent-bff`

**AWS infra**
- [ ] IAM: thêm `bedrock:InvokeModel`/`Retrieve*`, s3 bucket-level; sửa scope `lambda:InvokeFunction`
- [ ] Build/publish 2 layer (+ model weights) hoặc container-image
- [ ] Viết & deploy 4 lambda còn thiếu (+ `create-function` lần đầu)
- [ ] `agent-bff` hardening + response tasks/followUpQuestions
- [ ] CORS gateway scoped domain Amplify + OPTIONS trên mọi path
- [ ] Bedrock model access (region) đã được cấp
- [ ] Bedrock Agent + Action Group + alias + resource policy
- [ ] S3 buckets + bucket policy
- [ ] SES verify sender + thoát sandbox
- [ ] EventBridge cron + permission + DLQ
- [ ] CloudWatch retention + alarms + access log

**KB / RAG**
- [ ] Tạo `media_chunks` + `search_similar_chunks`
- [ ] Đổi model embedding đa ngữ 384d + re-embed
- [ ] Pipeline ingest (crawl→chunk→embed→upsert) + seed KB

**Amplify**
- [ ] `amplify.yml` (appRoot web, baseDirectory `.output/public`, `npm run generate`)
- [ ] Redirect 200 → `/index.html`
- [ ] Inject `NUXT_PUBLIC_*` build-time
- [ ] Custom domain + HTTPS + Supabase Auth Site/Redirect URL
- [ ] Fail-fast khi thiếu `NUXT_PUBLIC_SUPABASE_*`

**Smoke test end-to-end**
- [ ] Agent chat tạo/sửa/xóa task
- [ ] Emotion detect
- [ ] RAG (sau khi KB đã ingest)
- [ ] Report (S3 + email)
- [ ] Embed + Embed-all
- [ ] (tùy chọn) AI Suggestions

---

I have everything I need. The file ends at section 11 (line 442). Now I'll produce the merged markdown block applying all VERIFICATION adjustments. Below is the final markdown.

---

## 12. Lịch triển khai 2 tuần (10 ngày làm việc)

> Giả định: người thực hiện ĐÃ QUEN AWS (Lambda/API Gateway/Bedrock) ⇒ phần engineering đi nhanh, chừa thời gian cho doc/diagram/PPT/test. Mỗi ngày ~6–7h hiệu dụng, KHÔNG nhồi quá tải. Mã tham chiếu: P0/P1 (§4), A1–F3 (§5), route/contract (§4 bảng route).
>
> **Nguyên tắc Ngày 1:** kick-off NGAY 3 lead-time chạy nền song song toàn bộ 2 tuần — không nằm trên critical path nhưng nếu trễ sẽ chặn cuối kỳ. Ngoài ra dựng **test tooling** ngay nửa ngày đầu Tuần 1 vì §16 giả định các lệnh test chạy được.

### Lead-time kick-off (khởi động Ngày 1, theo dõi nền)

| Mã | Việc lead-time | Khởi động | Kỳ vọng xong | Chặn nếu trễ |
|---|---|---|---|---|
| D2 | SES: verify domain/sender (DKIM/SPF) + **xin thoát sandbox** | Ngày 1 sáng | Ngày 3–4 (24–48h) | Report email (A4, Ngày 7), hạn chót cứng trước Ngày 7 |
| C2 | Bedrock: **request model access** Claude 3 Haiku (region; fallback `us-east-1` đã có) | Ngày 1 sáng | Ngày 1–2 (lạc quan; có thể tới vài ngày) | Bedrock Agent (C1, Ngày 6) — **hạn chót cứng Ngày 6**; nếu chưa cấp tới Ngày 6 sẽ BLOCK toàn bộ agent flow |
| — | ACM: **request public cert** cho custom domain (DNS validation) | Ngày 1 sáng | Ngày 1–2 | Custom domain HTTPS (Ngày 9) |

> **Rủi ro C2:** cấp quyền Claude trên Bedrock có thể mất vài giờ tới vài ngày tùy region. Coi Ngày 6 là hạn chót cứng; nếu chậm, ưu tiên fallback `us-east-1`.

---

### TUẦN 1 — Engineering core (P0 + DB + Lambda + AI infra)

### Ngày 1 — Kick-off lead-time + dựng test tooling + P0 frontend security/auth

| | |
|---|---|
| **Mục tiêu** | Mở 3 lead-time song song; dựng hạ tầng test; dọn repo an toàn; vá auth client (P0). |
| **Task** | • **Kick-off D2 (SES), C2 (Bedrock access), ACM cert** — submit ngay, theo dõi nền.<br>• **Dựng test tooling (nửa ngày, song song P0):** cài `vitest` + tạo `web/vitest.config.ts` (package.json đã khai script `"test":"vitest"` nhưng dependency CHƯA cài); cài + config Playwright (`web/playwright.config.ts`, chưa có trong deps); scaffold `pytest` + `requirements-dev.txt` cho mỗi lambda; viết `scripts/smoke.sh` (gói S0–S6).<br>• **F2** `.gitignore` (web/.env, .nuxt, .output, node_modules) — LÀM TRƯỚC mọi commit.<br>• **P0 Auth (a):** tạo wrapper `web/composables/useApi.ts` lấy `session.access_token` qua `getSupabase().auth.getSession()`, gắn `Authorization: Bearer <jwt>` cho **cả 5** call AI. Quyết định cơ chế authorizer (native JWKS vs **custom Lambda authorizer HS256** — Supabase thường HS256 ⇒ nghiêng custom).<br>• Dọn comment `// JWT from auth` + `userId` thừa trong body `/agent/chat` (§6). |
| **Deliverable** | 3 lead-time đã submit; test tooling (vitest/Playwright/pytest/smoke.sh) chạy được khung rỗng; `.gitignore` commit; `useApi.ts` gắn JWT cho 5 call; quyết định authorizer đã chốt (ghi vào doc). |
| **Phụ thuộc** | Không (đường khởi đầu). |

### Ngày 2 — P0 frontend route/contract + Supabase security

| | |
|---|---|
| **Mục tiêu** | Chuẩn hoá route/body FE↔openapi↔lambda; vá lỗ hổng RLS leo quyền. |
| **Task** | • **P0 Route (a):** chốt 1 bộ route chuẩn (bảng §4) — sửa FE `/emotion`, `/rag`, `/embed`, `/embed-all`, `/agent/chat`, `/report` + body `/report` (`md_content`). Cập nhật openapi đồng thời.<br>• **P0 RLS (a):** vá `Users update own profile` thêm `WITH CHECK` cấm đổi `role`/`status` (`00006`); siết `daily_worklogs`/`daily_stats` INSERT về `service_role`; gộp 1 bộ RLS admin (`is_admin()`).<br>• Dọn `catch{}` im lặng (useRAG/emotion/report) → surface lỗi.<br>• Gate/xóa demo credentials `00005` (§6). |
| **Deliverable** | FE + openapi cùng 1 contract; migration RLS-fix mới (vd `00008_rls_hardening.sql`) chạy pass trên Supabase. |
| **Phụ thuộc** | Ngày 1 (wrapper JWT). |

### Ngày 3 — Supabase KB schema + Secrets/IAM

| | |
|---|---|
| **Mục tiêu** | Hoàn tất nền DB cho RAG; chuẩn bị Secrets & IAM cho Lambda. |
| **Task** | • **(d) KB:** **E1** tạo `media_chunks` (FK→`media_library` ON DELETE CASCADE, chunk_index, content_text, embedding_vector VECTOR(384), token_count, + cột `language`, `model_name/version`) + index ivfflat/hnsw + index media_id. **E2** `search_similar_chunks()` join chunks↔library (hàm MỚI; phân biệt với `search_similar_content` hiện có trong `00001`).<br>• **(f) Hardening:** **D4** secret `focus-mode/*` (service_role + JWT secret) trong Secrets Manager.<br>• IAM role: thêm `bedrock:InvokeModel`/`Retrieve*`, s3 bucket-level; **sửa scope `lambda:InvokeFunction` khớp tên hàm thật** (`agent-bff`/`agent-action-handler`).<br>• Dọn seed admin trùng `00002`/`00004`. |
| **Deliverable** | `media_chunks` + `search_similar_chunks` live; secret tạo xong; IAM role cập nhật. |
| **Phụ thuộc** | Ngày 2 (DB). C2/ACM kỳ vọng đã cấp xong (theo dõi). |

### Ngày 4 — Layers + Lambda nhẹ (emotion + embed)

| | |
|---|---|
| **Mục tiêu** | Dựng 2 layer; code 2 lambda inference nhẹ. |
| **Task** | • **(b) Layer:** **B1** layer onnx-transformers (~120MB) + ship ONNX weights `/opt/model`. **B2** layer sentence-transformers — nếu vượt 250MB unzip ⇒ chuyển **container-image Lambda** (quyết định nhanh).<br>• **(b) Lambda A1** `emotion-detector` (`{text}`→`{label,confidence}`, distilbert ONNX INT8). 5 nhãn: focused/stressed/exhausted/relaxed/unmotivated.<br>• **(b) Lambda A3** `admin-vectorizer/embed` (`/embed` by mediaId, `/embed-all` batch→`{count}`) đọc service_role từ Secrets Manager. Thêm admin-role check.<br>• Lưu ý `deploy.sh`: lần đầu phải `create-function`. |
| **Deliverable** | 2 layer published; A1 + A3 deploy & smoke-test bằng `curl` (chưa qua FE); pytest L6/L8 khung. |
| **Phụ thuộc** | Ngày 3 (IAM, Secrets). |

### Ngày 5 — Lambda RAG + agent-bff hardening + KB embedding model

| | |
|---|---|
| **Mục tiêu** | Hoàn tất nhóm lambda inference; chốt model đa ngữ. |
| **Task** | • **(b) Lambda A2** `rag-recommender` (`{emotion,limit}`→`[{id,title,source,...}]`), embed query CÙNG model với stored, gọi `search_similar_chunks()`.<br>• **(d) E3:** đổi model embedding sang `paraphrase-multilingual-MiniLM-L12-v2` (vẫn 384d) — áp cho A2 + A3; lưu `model_name/version`+`language`.<br>• **P1 (f) agent-bff hardening:** `try/except` quanh `json.loads`/`inputText`; CORS trên mọi path; pin claim shape (`jwt.claims.sub` cho HTTP v2); response thêm `tasks?`/`followUpQuestions?`.<br>• Buffer kỹ thuật ~1h. |
| **Deliverable** | A2 deploy & smoke-test; agent-bff hardened; model đa ngữ thống nhất query↔stored; chạy unit L1–L5 (`agent-bff`/action-handler). |
| **Phụ thuộc** | Ngày 4 (layers, A3). |

> **Cuối Tuần 1 — Buffer/optional (1 ngày trống):** ưu tiên dùng cho **E4 pipeline ingest KB** nếu Ngày 7 quá tải (xem Ngày 7); dọn nốt lambda lỗi smoke-test; bắt đầu **(g) outline tài liệu nộp** + thu thập screenshot.

---

### TUẦN 2 — AI wiring + Amplify + Doc/Diagram/PPT + Test

### Ngày 6 — Bedrock Agent + API Gateway + S3/EventBridge

| | |
|---|---|
| **Mục tiêu** | Dựng lớp orchestration AI và API edge. |
| **Task** | • **(c) C1:** Bedrock Agent (Claude 3 Haiku) + Action Group `todo-manager-api` (apiPath `/create-task`, `/update-task`, `/delete-task`) + alias `prod` + resource policy cho Bedrock gọi action-handler. Set `BEDROCK_AGENT_ID/ALIAS_ID` cho agent-bff. **Xác nhận `action-group-openapi` (OpenAPI cho Action Group) đã tồn tại**; nếu CHƯA, viết file này trong Ngày 6.<br>• **(c) API Gateway:** deploy theo openapi đã chuẩn hoá — **pin HTTP API v2** + JWT authorizer (hoặc **custom Lambda authorizer HS256** theo quyết định Ngày 1). CORS scoped domain Amplify + OPTIONS trên mọi path.<br>• **(d) D1:** S3 buckets `focus-mode-reports`/`focus-mode-audio` + bucket policy.<br>• **Smoke S0–S6 (curl, §16.2)** sau khi API GW + authorizer live: agent chat tạo/sửa/xóa task + access_token thật. |
| **Deliverable** | Agent end-to-end (curl) tạo task OK; API GW live có authorizer + CORS; S3 sẵn sàng; Smoke S0–S6 chạy (S3 RAG có thể BLOCKED tới khi ingest KB). |
| **Phụ thuộc** | Ngày 5 (lambda); **C2 model access ĐÃ cấp (bắt buộc tại đây — hạn chót cứng)**. |

### Ngày 7 — Lambda report + EventBridge + DLQ (E4 ingest tách sang ngày riêng/buffer)

| | |
|---|---|
| **Mục tiêu** | Hoàn tất lambda cuối + lịch chạy tự động. **Không gộp 2 hạng mục effort-L trong 1 ngày** ⇒ E4 (ingest KB, effort L) TÁCH khỏi Ngày 7. |
| **Task** | • **(b) Lambda A4** `report-generator` (`{md_content,user_id,date}`→`{markdown_url,pdf_url,message}`), S3 upload + SES (sender đã verify).<br>• **Đóng gói Pandoc cho A4 (rủi ro kỹ thuật):** Lambda runtime KHÔNG có Pandoc sẵn ⇒ dùng **container-image Lambda** hoặc **Pandoc layer (binary)** (tương tự cách xử lý layer B2 >250MB). Quyết định cách đưa Pandoc binary vào Lambda TRƯỚC khi code PDF export.<br>• **D3** EventBridge cron `cron(59 16 * * ? *)` + `lambda:AddPermission` + **DLQ**.<br>• Smoke-test emotion + report qua `curl` (L9 pytest A4). |
| **Deliverable** | A4 deploy (Pandoc đóng gói xong); cron + DLQ live. |
| **Phụ thuộc** | Ngày 6 (S3, API GW); **D2 SES thoát sandbox (bắt buộc cho email thật)**. |

### Ngày 7b/Buffer — E4 pipeline ingest KB (hạng mục effort-L tách riêng)

| | |
|---|---|
| **Mục tiêu** | Bơm dữ liệu thật vào KB để RAG không rỗng (dùng buffer trống cuối Tuần 1 hoặc 1 ngày riêng). |
| **Task** | • **(d) E4 pipeline ingest THẬT:** crawl (Dipkar/Khangser Rinpoche — **kiểm license**, lưu `source`) → clean → chunk → embed (`/embed-all` backfill) → upsert `media_chunks`. Đây là điều kiện để RAG trả kết quả thật.<br>• Sau ingest: chạy **S3 (`/rag`) + AC-10 + E2E-7** để gỡ trạng thái BLOCKED. |
| **Deliverable** | KB đã ingest ≥1 nguồn ⇒ RAG trả kết quả thật; S3/AC-10/E2E-7 PASS. |
| **Phụ thuộc** | Ngày 5 (A2/A3 + model đa ngữ), Ngày 6 (API GW); chạy được ngay khi có buffer trống. |

### Ngày 8 — Frontend wiring + Amplify deploy + observability + tạo tài khoản test prod

| | |
|---|---|
| **Mục tiêu** | Đưa SPA lên production, nối toàn bộ AI từ FE. |
| **Task** | • **(e) FE wiring:** verify 5 call AI qua wrapper JWT trỏ `NUXT_PUBLIC_API_GATEWAY_URL`; đổi build sang `nuxt generate`; fail-fast khi thiếu `NUXT_PUBLIC_SUPABASE_*`.<br>• **(e) F1** `amplify.yml` (appRoot `web`, baseDirectory `.output/public`, `npm run generate`) + **F3** top-level `aws/lambdas/README.md` index 6 hàm.<br>• **(e) Amplify deploy:** inject env `NUXT_PUBLIC_*`; redirect 200→`/index.html`.<br>• **(f) D5 observability:** CloudWatch log retention + alarm (errors/throttles/5xx) + API GW access log + X-Ray + DLQ.<br>• **Tạo tài khoản test prod (cho §16.1):** vì demo creds `00005` đã bị gate/xóa (P0 §6), tạo **user test approved** + **admin test** trên Supabase prod để lấy `ACCESS_TOKEN`/`ADMIN_TOKEN`. |
| **Deliverable** | SPA live trên Amplify default domain; AI gọi được từ FE; alarms + log retention bật; tài khoản test prod sẵn sàng. |
| **Phụ thuộc** | Ngày 7 (lambda đủ 6); ACM cert sẵn cho Ngày 9. |

### Ngày 9 — Custom domain + TEST production end-to-end + fix bug

| | |
|---|---|
| **Mục tiêu** | Production thật trên domain + pass full smoke/E2E. |
| **Task** | • **(e)** Custom domain + HTTPS (ACM cert); set Supabase Auth Site/Redirect URL = domain; `NUXT_PUBLIC_APP_URL` = domain thật.<br>• **(j) TEST production end-to-end** theo §7 GĐ10 + §16: E2E-1..8, AC-1..14; agent chat (CRUD task) → emotion → RAG (KB đã ingest) → report (S3+email) → embed/embed-all.<br>• **Cổng an ninh:** AC-13 (mọi route AI 401 khi thiếu/sai JWT) + AC-14 (user không tự leo `role/status` — RLS `WITH CHECK`).<br>• Fix bug phát hiện (auth/CORS/route/empty-KB). Re-test các luồng fail.<br>• Bắt đầu **(h) vẽ diagram** (Mermaid: architecture + ERD + sequence agent/RAG/report). |
| **Deliverable** | Checklist smoke-test (§11) + §16.7 tick PASS; domain HTTPS live; bug log + fix; bản nháp diagram Mermaid. |
| **Phụ thuộc** | Ngày 8 (Amplify + tài khoản test prod); E4 ingest đã xong (cho RAG); lead-time đã xong toàn bộ. |

### Ngày 10 — Tài liệu nộp + Diagram (export PNG) + PPT + buffer cuối

| | |
|---|---|
| **Mục tiêu** | Hoàn thiện bộ giao nộp; chốt buffer. |
| **Task** | • **(g) Tài liệu nộp:** hoàn chỉnh kiến trúc, hướng dẫn deploy, contract API, runbook test (đồng bộ CURRENT_STATE + Plan_and_Deploy).<br>• **(h) Diagram:** chốt Mermaid (§14) → **render Mermaid→PNG** bằng `mmdc` hoặc Kroki để xuất `architecture.png`, `erd.png`, `data-flow-ai.png` đúng định dạng nộp (§13.4).<br>• **(i) PPT:** slide tổng quan vấn đề → kiến trúc → demo screenshot (chụp `/dashboard` từ `dashboard.vue`, KHÔNG phải `/` landing) → kết quả test → chi phí/bảo mật → next steps.<br>• **(k) Buffer:** re-test nhanh sau mọi fix; kiểm tra cost guardrail (Bedrock token, CloudWatch retention). |
| **Deliverable** | Bộ nộp đầy đủ: docs + diagram PNG + PPT + test report PASS. |
| **Phụ thuộc** | Ngày 9 (kết quả test thật để đưa vào doc/PPT). |

> **Cuối Tuần 2 (buffer/optional):** dự phòng tràn việc Ngày 9–10; polish PPT; quay video demo nếu yêu cầu.

---

### Phân bổ thời gian theo nhóm hạng mục (tham chiếu yêu cầu a–k)

| Nhóm | Hạng mục | Ngày chính |
|---|---|---|
| (a) P0 security + auth/route | P0 Auth, Route, RLS, contract | 1–2 |
| (b) 4 lambda + 2 layer | A1, A2, A3, A4 + B1, B2 | 4–5, 7 |
| (c) Bedrock Agent + API GW | C1, API GW + authorizer + CORS | 6 |
| (d) KB (chunks + đa ngữ + ingest) | E1, E2, E3, E4 + D1 | 3, 5, 7b/buffer |
| (e) Frontend wiring + Amplify | F1, F3 + Amplify + domain | 8–9 |
| (f) Hardening (secrets/obs/CORS) | D4, D5, agent-bff, IAM | 3, 5, 8 |
| (g) Viết tài liệu nộp | — | 10 (outline tuần 1) |
| (h) Vẽ diagram + export PNG | — | 9–10 |
| (i) Làm PPT | — | 10 |
| (j) Test production + fix bug | smoke-test §11 + §16 | 9 |
| (k) Buffer | — | cuối tuần 1 & 2, Ngày 10 |
| — Test tooling | vitest/Playwright/pytest/smoke.sh | 1 (nửa ngày) |
| — **A5 `focus-ai-suggestions`** | **DEFER — ngoài phạm vi 2 tuần** (optional §5/§7/§11) | — |

---

### Sơ đồ tổng quan (Gantt 10 ngày, các nhóm song song)

```mermaid
gantt
    title Lịch triển khai Focus Mode App — 10 ngày làm việc
    dateFormat  YYYY-MM-DD
    axisFormat  D%d

    section Lead-time (nền)
    SES thoát sandbox (D2)        :crit, lt1, 2026-06-29, 4d
    Bedrock model access (C2)     :crit, lt2, 2026-06-29, 2d
    ACM cert                       :lt3, 2026-06-29, 2d

    section Test tooling
    vitest+Playwright+pytest+smoke :tt, 2026-06-29, 1d

    section (a) P0 security/auth/route
    Auth wrapper JWT + cleanup     :a1, 2026-06-29, 1d
    Route/contract + RLS hardening :a2, 2026-06-30, 1d

    section (d) KB + Supabase
    media_chunks + search fn (E1/E2):d1, 2026-07-01, 1d
    Model đa ngữ E3                 :d2, 2026-07-03, 1d
    Pipeline ingest E4 (tách)      :d3, 2026-07-04, 1d

    section (f) Secrets/IAM/Obs
    Secrets + IAM (D4)             :f1, 2026-07-01, 1d
    agent-bff hardening            :f2, 2026-07-03, 1d
    Observability D5               :f3, 2026-07-07, 1d

    section (b) Layers + Lambda
    Layers B1/B2                   :b1, 2026-07-02, 1d
    Lambda A1/A3                   :b2, 2026-07-02, 1d
    Lambda A2 (RAG)                :b3, 2026-07-03, 1d
    Lambda A4 + Pandoc + EventBridge:b4, 2026-07-07, 1d

    section (c) Bedrock + API GW
    Bedrock Agent + API GW + S3    :c1, 2026-07-06, 1d

    section (e) Frontend + Amplify
    FE wiring + Amplify + test acct:e1, 2026-07-07, 1d
    Custom domain + HTTPS          :e2, 2026-07-08, 1d

    section (j) Test production
    Smoke + E2E + AC + fix bug     :crit, j1, 2026-07-08, 1d

    section (g/h/i) Doc/Diagram/PPT
    Outline doc (optional)         :g0, 2026-07-04, 1d
    Diagram + export PNG           :g1, 2026-07-08, 2d
    Tài liệu nộp + PPT             :g2, 2026-07-09, 1d

    section (k) Buffer
    Buffer cuối kỳ                 :k1, 2026-07-09, 1d
```

> Critical path: lead-time (SES/Bedrock) → P0 auth/route (Ngày 1–2) → lambda (Ngày 4–5,7) → Bedrock+API GW (Ngày 6) → Amplify (Ngày 8) → **test production (Ngày 9)** → giao nộp (Ngày 10). E4 ingest tách khỏi Ngày 7 (dùng buffer Ngày 4/cuối Tuần 1). Doc/Diagram/PPT chạy song song từ Ngày 8 để không dồn cuối kỳ.

---

## 13. Gói tài liệu nộp (Submission Package)

> Mục tiêu: bộ tài liệu nộp cuối kỳ phải **khớp tuyệt đối** với code thực tế (xem `CURRENT_STATE.md`) và với contract/route trong §4, mã hạng mục §5 của runbook này. Không mô tả `profiles` / `user_requests` / `approve-user` (đã gỡ ở migration `00007`). Không quảng cáo offline-first / IndexedDB / sync queue (đã gỡ — app là cloud-only Supabase).

### 13.1 Bảng tài liệu nộp

Quy ước cột **Ngày hoàn thành** map vào §12 (lộ trình 2 tuần): `W1` = tuần 1, `W2` = tuần 2, `W2-end` = chốt nộp cuối (≈ Ngày 10); ghi rõ phụ thuộc khi cần.

| # | Tài liệu | Mục đích | Nguồn đã có (file trong `docs/` / repo) | Việc còn lại | Ngày hoàn thành (§12) |
|---|---|---|---|---|---|
| 1 | **Báo cáo dự án** (`report.pdf`) | Báo cáo tổng kết: bối cảnh, mục tiêu, kiến trúc, kết quả, đánh giá, hướng phát triển | `docs/project-assessment.md` (DÙNG LẠI làm phần đánh giá); `docs/Internship Documentation.md`, `docs/Supply Document.md` (khung nội dung); §1–§3 runbook | **VIẾT MỚI** bản tổng hợp; trích §1 (executive summary), §2 (hiện trạng), §3 (đã làm); chèn diagram §13.4; export PDF | W2-end (Ngày 10) |
| 2 | **Architecture doc** (`architecture.md`) | Mô tả kiến trúc mục tiêu: Nuxt SPA (Amplify) ↔ Supabase ↔ AWS AI; data flow 5 component AI | §1 (sơ đồ ASCII), §9 (nối AI end-to-end) của runbook; `docs/cloud-migration-plan.md` (DÙNG LẠI cho phần migration cloud-only) | **VIẾT MỚI** từ §1+§9; **KHÔNG dùng lại** `docs/architecture.md` cũ nếu là transcript chat (xem §6 — gây hiểu nhầm canonical); vẽ lại diagram chuẩn (§13.4/§14) | W2 |
| 3 | **API documentation** (`api-contracts.md` + `openapi.yaml`) | Đặc tả request/response 6 Lambda + API Gateway route + auth | **DÙNG LẠI** `docs/api/lambda_contracts.md` (đã cập nhật 2026-06-29, có bảng trạng thái implement) + `docs/api/openapi.yaml` | **BỔ SUNG**: chuẩn hoá route theo bảng §4 (FE `/emotion` `/rag` `/embed*` vs openapi `/emotion/detect`…); sync openapi với route chuẩn; ghi rõ auth = Supabase JWT | W2 (sau khi pin route §4, Ngày 2) |
| 4 | **Database schema + ERD doc** (`database.md` + `erd.png`) | Mô tả 7 bảng `public` + extensions + functions + RLS; ERD quan hệ | **DÙNG LẠI** `supabase/migrations/00001…00007`, `supabase/rls_policies.sql`, `supabase/README.md`; `docs/database/schema.sql` (đối chiếu) | **VIẾT MỚI** doc tổng hợp theo §`DB tables` của CURRENT_STATE (gồm `media_chunks` E1 nếu đã thêm); **XÓA** `docs/database/indexeddb_schema.ts` khỏi gói nộp (offline-first đã gỡ); render ERD từ §14.8 → `erd.png` | W2 |
| 5 | **Deployment runbook** (`runbook.md`) | Hướng dẫn deploy end-to-end + checklist pre-deploy | **DÙNG LẠI** chính là **`Plan_and_Deploy.md`** (§7 lộ trình, §8 Amplify, §9 nối AI, §11 checklist, §12 lịch 2 tuần) | Đổi tên/copy thành `submission/runbook.md`; rà lại các bước đã thực thi → tick checklist §11; thêm ảnh chụp Amplify/API GW console | W2-end (Ngày 10) |
| 6 | **Test report / results** (`test-report.md`) | Bằng chứng test production pass: unit + smoke E2E từng route AI | **DÙNG LẠI** `docs/testing-plan.md` (làm phần "kế hoạch test") + §16 (smoke/unit/E2E/pytest/AC) | **VIẾT MỚI** phần "kết quả": chạy Vitest (stores/composables) + smoke `curl` 6 route (§16.2) với access_token thật; bảng pass/fail + log/screenshot | W2-end (sau smoke test §7 GĐ10 / Ngày 9) |
| 7 | **User guide** (`user-guide.md`) | Hướng dẫn sử dụng: đăng ký→duyệt, Tasks, Focus timer, Agent, Calendar, Admin | `docs/user-stories.md` (DÙNG LẠI làm khung tính năng); `docs/admin-cms.md` (DÙNG LẠI cho phần Admin) | **VIẾT MỚI** hướng dẫn end-user theo Pages thực tế (CURRENT_STATE §Pages/Tasks/Focus): review-on-complete, khóa tick khi đang focus, 3 tab login; chèn screenshot | W2 |
| 8 | **Security & RLS notes** (`security.md`) | Ghi nhận biên giới an ninh (RLS), lỗ hổng đã vá, xử lý secret | §4 (P0 RLS leo quyền, P1 Secrets Manager), §10 (Bảo mật/Secret) runbook; `supabase/rls_policies.sql` | **VIẾT MỚI** tóm tắt: vá `WITH CHECK` role/status, siết worklog/stats INSERT về service_role, service_role chỉ ở Lambda + Secrets Manager, gate demo creds `00005` | W2 |
| 9 | **Cost / free-tier analysis** (`cost.md`) | Phân tích chi phí & free-tier AWS + Supabase | §10 (Free-tier & chi phí) runbook | **VIẾT MỚI** bảng theo dịch vụ: Bedrock (KHÔNG free-tier, theo token), Lambda GB-s, S3/SES/CloudWatch, NAT (psycopg2 vs supabase-py REST), Supabase free tier; ước tính cho <10 user | W2 |
| 10 | **README.md repo** (`README.md`) | Điểm vào repo: mô tả, cấu trúc thư mục, cách chạy local, link tới các doc khác | `supabase/README.md` (DÙNG LẠI cho phần DB); `docs/nuxt-directory-structure.md` (DÙNG LẠI cho cấu trúc FE); `docs/environment.example` | **VIẾT MỚI** README root (repo chưa có README chuẩn): quickstart `web/` (`npm ci`→`npm run dev`/`generate`), env vars (§8), link runbook/architecture/api | W1 (bản nháp), W2-end (chốt) |
| 11 | **Demo video script** (`demo-script.md`) | Kịch bản quay demo end-to-end production | — (chưa có) | **VIẾT MỚI** kịch bản theo luồng smoke test §7 GĐ10: login→`/dashboard`→Tasks→Focus(emotion+RAG)→Agent tạo/sửa task→Export report→Admin duyệt user/embed media; **chụp `/dashboard` (dashboard.vue), KHÔNG phải `/` (index.vue là landing marketing)**; timestamp + lời thoại | W2-end (Ngày 10) |

### 13.2 Đối chiếu file `docs/` hiện có — DÙNG LẠI vs CẦN VIẾT/BỔ SUNG

| File `docs/` hiện có | Phân loại | Hành động |
|---|---|---|
| `docs/api/lambda_contracts.md` | **DÙNG LẠI** | Đã sync 2026-06-29; chỉ chuẩn hoá route theo §4 → tài liệu #3 |
| `docs/api/openapi.yaml` | **BỔ SUNG** | Sync route/body với bảng contract §4 → tài liệu #3 |
| `docs/state-management.md` | **DÙNG LẠI** (có sửa) | Phụ lục cho #2/#10; rà lại theo stores thực (`task`/`focus`/`user`, KHÔNG có `sync`/`dashboard`/`media`/`auth` store) |
| `docs/nuxt-directory-structure.md` | **DÙNG LẠI** | Phụ lục cấu trúc FE cho #10 |
| `docs/admin-cms.md` | **DÙNG LẠI** | Phần Admin của #7 (User guide) |
| `docs/user-stories.md` | **DÙNG LẠI** | Khung tính năng cho #7 |
| `docs/nlp-emotion.md` | **DÙNG LẠI** (có sửa) | Phụ lục AI cho #3; bổ sung nhãn thứ 5 `unmotivated`; đồng bộ route `/emotion` |
| `docs/rag-vectorisation.md` | **BỔ SUNG** | Phụ lục AI cho #3/#4; cập nhật model `paraphrase-multilingual-MiniLM-L12-v2` (E3), bảng `media_chunks` (E1), `search_similar_chunks` (E2) |
| `docs/testing-plan.md` | **DÙNG LẠI** | Khung kế hoạch của #6; bổ sung phần kết quả thực tế (§16) |
| `docs/project-assessment.md` | **DÙNG LẠI** | Phần đánh giá của #1 (Final report) |
| `docs/cloud-migration-plan.md` | **DÙNG LẠI** | Phần migration cloud-only của #2 (Architecture) |
| `supabase/README.md` | **DÙNG LẠI** | Nguồn cho #4 (DB) và #10 (README) |
| `docs/offline-sync.md` | **LOẠI BỎ** khỏi gói nộp | Offline-first đã gỡ hoàn toàn (CURRENT_STATE §9); KHÔNG nộp, tránh mâu thuẫn sự thật |
| `docs/database/indexeddb_schema.ts` | **LOẠI BỎ** khỏi gói nộp | IndexedDB đã gỡ; không phản ánh DB thực |
| `docs/cicd-cloudflare-pages.yml` | **LOẠI BỎ / VIẾT LẠI** | Sai platform (GitLab/Cloudflare/pnpm) (§6); nếu cần CI thì viết mới cho GitHub Actions + Amplify |
| `docs/database/schema.sql` | **ĐỐI CHIẾU** | Chỉ dùng để cross-check với migration `00001…00007`; nguồn sự thật là migrations |
| `docs/architecture.md` (nếu tồn tại/transcript) | **KHÔNG dùng lại** | §6 cảnh báo là transcript, không phải design artifact → viết mới #2 |
| `docs/environment.example` | **DÙNG LẠI** | Tham chiếu env cho #5/#10 (đối chiếu §8 Amplify env) |
| `docs/Internship Documentation.md`, `docs/Supply Document.md` | **DÙNG LẠI** | Khung nội dung/biểu mẫu cho #1 (Final report) |

**Tài liệu CHƯA có nguồn — VIẾT HOÀN TOÀN MỚI:** #1 (final report tổng hợp), #8 (security & RLS notes), #9 (cost/free-tier), #11 (demo video script), và README.md root (#10).

### 13.3 Checklist nộp nhanh

- [ ] #1 `report.pdf` — tổng hợp + export PDF
- [ ] #2 `architecture.md` + diagram (không dùng transcript cũ)
- [ ] #3 `api-contracts.md` + `openapi.yaml` đã chuẩn route §4
- [ ] #4 `database.md` + `erd.png` (gồm `media_chunks` nếu đã thêm)
- [ ] #5 `runbook.md` (copy `Plan_and_Deploy.md`, tick checklist §11)
- [ ] #6 `test-report.md` (Vitest + smoke `curl` 6 route, pass/fail — §16)
- [ ] #7 `user-guide.md` + screenshot theo Pages thực
- [ ] #8 `security.md` (RLS vá, secret handling)
- [ ] #9 `cost.md` (free-tier + Bedrock token)
- [ ] #10 `README.md` root + quickstart
- [ ] #11 `demo-script.md` + link video (screenshot từ `/dashboard`, không phải `/`)
- [ ] Loại bỏ `offline-sync.md`, `indexeddb_schema.ts`, `cicd-cloudflare-pages.yml` khỏi gói nộp

### 13.4 Cấu trúc thư mục nộp

```
/submission
├── report.pdf                 # #1 Final report (export PDF)
├── slides.pptx                # Slide thuyết trình (§15)
├── runbook.md                 # #5 = bản copy Plan_and_Deploy.md (đã tick §11)
├── architecture.md            # #2
├── database.md                # #4 (mô tả schema + RLS + functions)
├── security.md                # #8 Security & RLS notes
├── cost.md                    # #9 Cost / free-tier analysis
├── user-guide.md              # #7
├── test-report.md             # #6 (kết quả thực tế §16)
├── demo-script.md             # #11 (kịch bản quay)
├── api/
│   ├── api-contracts.md       # #3 (từ docs/api/lambda_contracts.md)
│   └── openapi.yaml           # #3 (đã sync route §4)
├── diagrams/                  # render Mermaid §14 → PNG bằng mmdc/Kroki (Ngày 10)
│   ├── architecture.png       # từ §14.1 (SPA ↔ Supabase ↔ AWS AI)
│   ├── erd.png                # từ §14.8 (7 bảng + media_chunks)
│   └── data-flow-ai.png       # từ §14.3–14.7 (luồng 6 component AI)
├── screenshots/               # Amplify, API GW, app UI (/dashboard, cho #5/#6/#7)
└── video/
    └── demo.mp4               # (hoặc link YouTube/Drive trong demo-script.md)
```

> Lưu ý nhất quán: README.md (#10) nằm ở **repo root** (không trong `/submission`); `runbook.md` trong `/submission` là bản copy của `Plan_and_Deploy.md` để gom đủ artifact một chỗ khi nộp. Các file `.png` trong `diagrams/` là kết quả **render Mermaid→PNG** từ §14 (bước Ngày 10), không phải Mermaid thô.

---

## 14. Sơ đồ kiến trúc & luồng (Mermaid)

> Tên component/route/bảng/Lambda dùng CHÍNH XÁC theo repo. Route AI theo bộ chuẩn hoá §4 (`/agent/chat`, `/emotion`, `/rag`, `/report`, `/embed`, `/embed-all`). Bảng `media_chunks` + hàm `search_similar_chunks` là hạng mục CẦN THÊM (§5 E1/E2) — đánh dấu rõ trong ERD/sequence. Các diagram dưới đây là nguồn để render PNG nộp (§13.4): `architecture.png` ← §14.1, `erd.png` ← §14.8, `data-flow-ai.png` ← §14.3–14.7. PPT §15 tham chiếu trực tiếp các diagram này.

### 14.1 System architecture tổng

```mermaid
graph TB
  subgraph Client["Browser"]
    SPA["Nuxt SPA (Vue3 + Pinia + Tailwind)<br/>pages: / (landing) · /dashboard · /focus · /agent · /tasks · /calendar · /admin/media · /admin/users · /login<br/>components: AgentChat.vue · EmotionBadge.vue · ExportReportButton.vue<br/>composables: useAgentChat · useEmotionDetector · useRAG · useReportExport · useDataService"]
  end

  subgraph Amplify["AWS Amplify Hosting (static)"]
    CDN["nuxt generate → web/.output/public<br/>SPA redirect 200 → /index.html"]
  end

  subgraph Supabase["Supabase Cloud"]
    PG[("Postgres + pgvector<br/>users · tasks · focus_sessions<br/>daily_worklogs · daily_stats<br/>media_library · media_chunks* · sync_log")]
    AUTH["Supabase Auth (JWT)"]
  end

  subgraph AWS["AWS"]
    APIGW["API Gateway<br/>JWT authorizer + CORS (Amplify origin)"]
    BFF["agent-bff"]
    ACT["agent-action-handler"]
    EMO["emotion-detector*"]
    RAG["rag-recommender*"]
    VEC["admin-vectorizer*"]
    REP["report-generator*"]
    BR["Bedrock Agent + Action Group<br/>todo-manager-api"]
    S3[("S3<br/>focus-mode-reports")]
    SES["SES (email)"]
    EB["EventBridge (cron)"]
  end

  SPA -->|"static assets"| CDN
  SPA -->|"read/write anon key + RLS"| PG
  SPA -->|"signIn / session JWT"| AUTH
  SPA -->|"Bearer JWT"| APIGW

  APIGW --> BFF
  APIGW --> EMO
  APIGW --> RAG
  APIGW --> VEC
  APIGW --> REP

  BFF --> BR
  BR --> ACT
  ACT -->|"service_role"| PG
  RAG -->|"search_similar_chunks*"| PG
  VEC -->|"upsert embedding"| PG
  EMO -->|"Bedrock/ONNX"| BR
  REP --> S3
  REP --> SES
  REP -->|"service_role"| PG
  EB --> REP

  classDef todo stroke-dasharray: 5 5;
  class EMO,RAG,VEC,REP todo;
```
*Caption:* Kiến trúc tổng — Browser/Nuxt SPA trên Amplify đọc/ghi trực tiếp Supabase (anon key + RLS) và gọi 6 Lambda AI qua API Gateway (JWT). Pages liệt kê đầy đủ: `/` là **landing marketing** (index.vue), `/dashboard` chứa `ExportReportButton`, `/calendar` dùng `EmotionBadge`; `*` = hạng mục CẦN THÊM (Lambda chưa code, bảng `media_chunks`).

### 14.2 Deployment topology

```mermaid
graph LR
  Dev["GitHub repo<br/>web/ · aws/ · supabase/"]

  subgraph CloudFront_Amplify["Amplify (CloudFront edge)"]
    Static["Nuxt SPA static<br/>web/.output/public"]
  end

  subgraph SupabaseCloud["Supabase Project (region)"]
    DB[("Postgres + pgvector + Auth")]
  end

  subgraph AWSRegion["AWS Region (ap-southeast-1 / us-east-1)"]
    GW["API Gateway (stage: prod)"]
    L1["agent-bff"]
    L2["agent-action-handler"]
    L3["emotion-detector*"]
    L4["rag-recommender*"]
    L5["admin-vectorizer*"]
    L6["report-generator*"]
    LAY["Layers: onnx-transformers* · sentence-transformers*"]
    BRA["Bedrock Agent (alias prod)"]
    SM["Secrets Manager<br/>service_role + JWT secret"]
    S3B[("S3 focus-mode-reports")]
    SESB["SES"]
    EBR["EventBridge cron(59 16 * * ? *)"]
    CW["CloudWatch Logs / Alarms"]
  end

  Dev -->|"git push → build"| Static
  Dev -->|"deploy.sh / IaC"| L1
  Static -->|"HTTPS"| DB
  Static -->|"HTTPS Bearer JWT"| GW
  GW --> L1 & L3 & L4 & L5 & L6
  L1 --> BRA --> L2 --> DB
  L3 & L4 & L5 & L6 -. uses .-> LAY
  L4 & L5 & L6 & L2 --> DB
  L1 & L2 & L3 & L4 & L5 & L6 -->|"GetSecretValue"| SM
  L6 --> S3B & SESB
  EBR --> L6
  L1 & L2 & L3 & L4 & L5 & L6 --> CW
```
*Caption:* Topology triển khai — SPA chạy trên Amplify/CloudFront; Supabase là project cloud riêng; toàn bộ Lambda/Bedrock/S3/SES/EventBridge nằm trong 1 AWS region, secret qua Secrets Manager (`*` = chưa hoàn thiện).

### 14.3 Sequence — Agent chat

```mermaid
sequenceDiagram
  participant U as AgentChat.vue (/agent)
  participant C as useAgentChat
  participant GW as API Gateway (JWT authorizer)
  participant BFF as agent-bff
  participant BR as Bedrock Agent
  participant ACT as agent-action-handler
  participant DB as Supabase (tasks)

  U->>C: sendMessage(inputText)
  C->>GW: POST /agent/chat {sessionId, inputText}<br/>Authorization: Bearer <access_token>
  GW->>GW: validate Supabase JWT
  GW->>BFF: event (claims.sub = userId)
  BFF->>BR: invoke_agent(sessionAttributes.userId)
  BR->>ACT: Action Group todo-manager-api<br/>apiPath /create-task | /update-task | /delete-task
  ACT->>DB: insert / update / delete tasks (service_role)
  DB-->>ACT: ok
  ACT-->>BR: action_response(200, message)
  BR-->>BFF: completion (stream chunks)
  BFF-->>C: {sessionId, responseText, tasks?, followUpQuestions?}
  C-->>U: render agent message + tasks
```
*Caption:* Agent chat — FE → API GW (JWT) → `agent-bff` → Bedrock Agent → Action Group `todo-manager-api` → `agent-action-handler` ghi `tasks` vào Supabase bằng service_role.

### 14.4 Sequence — Emotion detection

```mermaid
sequenceDiagram
  participant F as focus.vue (Session Complete)
  participant C as useEmotionDetector
  participant GW as API Gateway (JWT)
  participant EMO as emotion-detector*
  participant DB as Supabase (focus_sessions)

  F->>C: detect(journalText) [debounced]
  alt apiGatewayUrl có cấu hình
    C->>GW: POST /emotion {text}<br/>Bearer <access_token>
    GW->>EMO: event
    EMO->>EMO: ONNX distilbert INT8 (/opt/model)
    EMO-->>C: {label, confidence}
  else thiếu API
    C->>C: fallback regex client-side
  end
  C-->>F: EmotionBadge {label, confidence}
  F->>DB: lưu emotion_label / emotion_confidence khi save session
```
*Caption:* Emotion — `focus.vue` gọi `useEmotionDetector` → `/emotion` (`emotion-detector` ONNX); nếu chưa cấu hình API thì fallback regex; nhãn `focused|stressed|exhausted|relaxed|unmotivated` lưu vào `focus_sessions`. Lưu ý: `EmotionBadge.vue` (display-only) cũng được `calendar.vue` import để hiển thị emotion trong heatmap, không chỉ riêng `focus.vue`.

### 14.5 Sequence — RAG recommendation

```mermaid
sequenceDiagram
  participant F as focus.vue
  participant C as useRAG
  participant GW as API Gateway (JWT)
  participant RAG as rag-recommender*
  participant DB as Supabase (pgvector)

  F->>C: getRecommendations(emotionLabel)
  C->>GW: POST /rag {emotion, limit:3}<br/>Bearer <access_token>
  GW->>RAG: event
  RAG->>RAG: embed query (paraphrase-multilingual-MiniLM-L12-v2, 384d)
  RAG->>DB: search_similar_chunks*(query_embedding, match_count)
  Note over DB: JOIN media_chunks* ↔ media_library<br/>cosine (embedding_vector <=> q)
  DB-->>RAG: rows {id,title,source,type,...}
  RAG-->>C: [{id,title,source,type,...}]
  C-->>F: render recommended content
```
*Caption:* RAG — `useRAG` → `/rag` → `rag-recommender` embed query rồi gọi `search_similar_chunks` (`*` CẦN THÊM, E2 — hàm MỚI, phân biệt với `search_similar_content` hiện có trong `00001:195`) join `media_chunks`↔`media_library`; nếu KB chưa ingest/embed (E4) thì kết quả rỗng.

### 14.6 Sequence — Report (S3 + SES)

```mermaid
sequenceDiagram
  participant B as ExportReportButton.vue (/dashboard)
  participant C as useReportExport
  participant GW as API Gateway (JWT)
  participant REP as report-generator*
  participant DB as Supabase
  participant S3 as S3 focus-mode-reports
  participant SES as SES
  participant EB as EventBridge cron

  B->>C: exportReport()
  C->>C: render MD_TEMPLATE từ tasks/sessions
  alt apiGatewayUrl có cấu hình
    C->>GW: POST /report {md_content, user_id, date}<br/>Bearer <access_token>
    GW->>REP: event
    REP->>DB: (tùy chọn) đọc daily_worklogs / dựng từ DB
    REP->>S3: upload .md (+ Pandoc → .pdf; Pandoc đóng gói qua layer/container)
    REP->>SES: send email
    REP-->>C: {markdown_url, pdf_url, message}
    C-->>B: mở pdf_url
  else thiếu API
    C-->>B: fallback tải .md ở client
  end
  EB->>REP: cron(59 16 * * ? *) — sinh report cho toàn user
```
*Caption:* Report — `ExportReportButton.vue` (đặt ở `/dashboard`) → `useReportExport` → `/report` → `report-generator` upload S3 + gửi SES; Pandoc→PDF cần đóng gói qua layer/container (Lambda runtime không có sẵn); EventBridge cron chạy hằng đêm cho toàn user; thiếu API thì tải `.md` client.

### 14.7 Sequence — Embedding / Vectorize

```mermaid
sequenceDiagram
  participant M as admin/media.vue
  participant C as useDataService
  participant GW as API Gateway (JWT)
  participant VEC as admin-vectorizer*
  participant DB as Supabase

  rect rgb(245,245,245)
  Note over M,DB: Embed 1 item
  M->>C: generateEmbedding(mediaId)
  C->>GW: POST /embed {mediaId}<br/>Bearer <access_token>
  GW->>VEC: event
  VEC->>DB: SELECT media_library WHERE id = mediaId
  VEC->>VEC: chunk + embed (sentence-transformers 384d)
  VEC->>DB: upsert media_chunks* + media_library.embedding_vector
  VEC-->>C: {ok}
  end

  rect rgb(245,245,245)
  Note over M,DB: Embed batch
  M->>C: generateAllEmbeddings()
  C->>GW: POST /embed-all {}
  GW->>VEC: event
  VEC->>DB: backfill media chưa có vector
  VEC-->>C: {count}
  end
```
*Caption:* Embedding — `admin/media.vue` → `useDataService.generateEmbedding`/`generateAllEmbeddings` → `/embed` & `/embed-all` → `admin-vectorizer` chunk + embed rồi upsert `media_chunks` (`*` CẦN THÊM) + `media_library.embedding_vector`.

### 14.8 ERD

```mermaid
erDiagram
  users ||--o{ tasks : "user_id"
  users ||--o{ focus_sessions : "user_id"
  users ||--o{ daily_worklogs : "user_id"
  users ||--o{ daily_stats : "user_id"
  users ||--o{ media_library : "created_by"
  tasks ||--o{ focus_sessions : "task_id (SET NULL)"
  media_library ||--o{ media_chunks : "media_id (CASCADE) *"

  users {
    uuid id PK
    text email UK
    text display_name
    text role "user|admin"
    text status "pending|approved|rejected"
    timestamptz created_at
    timestamptz updated_at
  }
  tasks {
    uuid id PK
    uuid user_id FK
    text title
    text status "pending|in_progress|completed|cancelled"
    smallint priority "0..3"
    int duration_spent
    date due_date
    text review
  }
  focus_sessions {
    uuid id PK
    uuid user_id FK
    uuid task_id FK
    timestamptz start_time
    timestamptz end_time
    int duration_planned
    int duration_actual
    text journal_text
    text emotion_label
    real emotion_confidence
    text ambient_track
  }
  daily_worklogs {
    uuid id PK
    uuid user_id FK
    date date "UNIQUE(user_id,date)"
    int total_focus_time
    int sessions_count
    int tasks_completed
    text dominant_emotion
  }
  daily_stats {
    uuid id PK
    uuid user_id FK
    date date "UNIQUE(user_id,date)"
    int total_focus_seconds
    int streak_days
  }
  media_library {
    uuid id PK
    text title
    text content_text
    text type "quote|sutra|video|article|audio"
    text source
    vector embedding_vector "VECTOR(384)"
    uuid created_by FK
  }
  media_chunks {
    uuid id PK
    uuid media_id FK "* CẦN THÊM"
    int chunk_index
    text content_text
    vector embedding_vector "VECTOR(384)"
    int token_count
  }
  sync_log {
    uuid id PK
    text table_name
    uuid record_id
    text operation "INSERT|UPDATE|DELETE"
    jsonb payload
  }
```
*Caption:* ERD `public` — quan hệ chính qua `user_id`; `focus_sessions.task_id` FK → `tasks` (ON DELETE SET NULL); `media_chunks` (`*` CẦN THÊM, E1) FK → `media_library` (ON DELETE CASCADE); `sync_log` là bảng log độc lập (di sản, không FK).

### 14.9 Auth & approval flow

```mermaid
sequenceDiagram
  participant U as login.vue (Request Access)
  participant SA as Supabase Auth (auth.users)
  participant TR as trigger handle_new_user()
  participant PU as public.users
  participant A as admin/users.vue
  participant AU as useAuth (approveUser/rejectUser)

  U->>SA: signUp(email, password)
  SA->>TR: AFTER INSERT ON auth.users
  TR->>PU: INSERT (role, status)
  Note over TR,PU: email ∈ admin list → role=admin, status=approved<br/>ngược lại → role=user, status=pending

  U->>SA: signInWithPassword
  SA-->>U: session (JWT)
  U->>PU: SELECT role, status (RLS: own row)
  alt status = pending
    U->>SA: signOut() — "pending admin approval"
  else status = rejected
    U->>SA: signOut() — "request rejected"
  else status = approved
    U-->>U: vào app
  end

  A->>PU: SELECT status='pending' (RLS is_admin → đọc mọi row)
  A->>AU: approveUser(id) / rejectUser(id)
  AU->>PU: UPDATE users.status = 'approved' | 'rejected'<br/>(RLS "Admins manage all users" — is_admin())
```
*Caption:* Auth & approval — signup → trigger `handle_new_user()` tạo `public.users` (status `pending`, admin auto `approved`); đăng nhập bị chặn nếu chưa `approved`; admin duyệt qua `admin/users.vue` → `useAuth.approveUser/rejectUser` `UPDATE users.status` được bảo vệ bởi RLS `is_admin()`.

---

## 15. Slide thuyết trình (Outline ~16–20 slide)

> Outline để tự dựng slide nhanh. Mỗi slide gồm: **Tiêu đề**, 3–5 bullet, 1 *Speaker note*, gợi ý visual (tham chiếu diagram ở §14). Thuật ngữ kỹ thuật giữ tiếng Anh. Nhất quán với route/contract §4 và mã hạng mục §5.

---

### Slide 1 — Title

- **Focus Mode App** — Ứng dụng quản lý phiên tập trung (Pomodoro/Focus) tích hợp AI
- Họ tên người thực hiện + vai trò (AI Engineer Intern)
- Đơn vị: **FCAJ Internship 2026**
- Stack 1 dòng: Nuxt SPA + Supabase (cloud-only) + AWS AI (Lambda/API Gateway/Bedrock)
- Ngày trình bày: 2026

*Speaker note:* "Em xin trình bày dự án Focus Mode App — sản phẩm internship FCAJ, một app focus tích hợp 5 tính năng AI deploy end-to-end trên AWS."

> Visual: logo FCAJ + ảnh hero **dashboard** chụp từ `/dashboard` (dashboard.vue), KHÔNG dùng `/` (index.vue là landing marketing). Không cần diagram.

---

### Slide 2 — Bối cảnh & Vấn đề (theo RFP)

- Người dùng khó duy trì tập trung; công cụ Pomodoro hiện tại thiếu chiều **cảm xúc & động lực**
- Sau mỗi phiên, không có nội dung phù hợp tâm trạng để phục hồi/tái tạo động lực
- Quản lý task rời rạc, thao tác tay nhiều, không có trợ lý hiểu ngữ cảnh
- Báo cáo tiến độ thủ công, không tự động tổng hợp
- **Mục tiêu RFP:** app focus + AI hiểu cảm xúc, gợi ý nội dung, tự động hoá task & report

*Speaker note:* "Vấn đề cốt lõi không chỉ là đếm giờ, mà là hiểu trạng thái người dùng và phản hồi đúng lúc — đó là khoảng trống AI lấp vào."

> Visual: 3 icon pain-point (mất tập trung / không động lực / báo cáo thủ công). Không cần diagram.

---

### Slide 3 — Giải pháp tổng quan

- SPA focus app: **Tasks** (review-on-complete), **Focus timer** (neo theo `endAt`, chính xác qua tab nền), **Calendar** heatmap, **Admin**
- 5 tính năng AI: **agent chat**, **emotion detection**, **RAG recommendation**, **report**, **embedding/vectorize**
- Kiến trúc: Frontend ↔ Supabase (read/write trực tiếp, RLS) + AWS xử lý AI (service_role)
- Cloud-only — đã gỡ hoàn toàn offline-first để đơn giản hoá & nhất quán dữ liệu

*Speaker note:* "Giải pháp chia 2 trục: app CRUD chạy thẳng Supabase, còn tác vụ AI nặng đẩy sang AWS Lambda/Bedrock."

> Visual: **§14.1 System architecture tổng** (Browser ↔ Supabase ↔ AWS) — bản thu gọn.

---

### Slide 4 — Demo flow (kịch bản trình diễn)

- **B1:** Đăng nhập → **`/dashboard`** (Today's Tasks)
- **B2:** Agent chat: "tạo task ôn thi 25 phút" → task `pending` xuất hiện (agent CRUD)
- **B3:** Bắt đầu Focus session (chỉ task `in_progress`) → hết giờ: chuông + Notification
- **B4:** Journal → **emotion detect** (vd `stressed`) → **RAG** gợi nội dung theo cảm xúc
- **B5:** Export **report** (Markdown/PDF) → kết thúc

*Speaker note:* "Em sẽ demo đúng 5 bước này; đăng nhập xong vào `/dashboard` (không phải landing `/`); nếu mạng lỗi, có sẵn video backup cho phần AI."

> Visual: **§14.3 Agent chat sequence** (end-to-end happy path) hoặc storyboard 5 ảnh màn hình chụp từ `/dashboard`, `/agent`, `/focus`.

---

### Slide 5 — Kiến trúc hệ thống

- **Frontend:** Nuxt SPA static (Amplify Hosting) — `nuxt generate` → `.output/public`
- **Data:** Supabase Postgres + Auth + pgvector; client dùng **anon key + RLS**
- **AI backend:** API Gateway (JWT authorizer) → Lambda → Bedrock Agent / pgvector / S3+SES
- **service_role** chỉ ở Lambda (bypass RLS) → đọc/ghi Supabase an toàn
- Luồng: `agent-bff → Bedrock Agent → agent-action-handler → Supabase task CRUD`

*Speaker note:* "Điểm mấu chốt: client không bao giờ chạm service_role; mọi tác vụ đặc quyền đi qua Lambda."

> Visual: **§14.1 Architecture diagram** (logical) — diagram trung tâm của bài; có thể kèm **§14.2 deployment topology** nếu tách 2 slide.

---

### Slide 6 — Tech stack

- **Frontend:** Nuxt 4 + Vue 3 + Pinia (`task`/`focus`/`user`) + Tailwind
- **Backend data:** Supabase (Postgres, Auth email/password, pgvector VECTOR(384))
- **AI/compute:** AWS Lambda (Python), API Gateway (HTTP API v2), **Amazon Bedrock** (Claude 3 Haiku Agent)
- **Storage/email/schedule:** S3, SES, EventBridge cron
- **Deploy/Secrets:** AWS Amplify Hosting, Secrets Manager, CloudWatch

*Speaker note:* "Stack chọn theo tiêu chí free-tier-friendly và đúng năng lực AWS sẵn có của em."

> Visual: layered stack (logo theo tầng: client / data / AI / infra). Tham chiếu **§14.2** cho lớp infra.

---

### Slide 7 — Tính năng AI (1/2): Agent & Emotion

- **Agent chat (`/agent/chat`):** Bedrock Agent + Action Group → `agent-action-handler` tạo/sửa/xóa task; response `{responseText, tasks?, followUpQuestions?}`
- Agent tạo task luôn ở `status='pending'` (nhất quán với nút "+ Add Task")
- **Emotion (`/emotion`):** distilbert ONNX INT8; input journal → `{label, confidence}`
- 5 nhãn: **focused, stressed, exhausted, relaxed, unmotivated**; fallback regex client nếu thiếu API

*Speaker note:* "Agent dùng Bedrock Action Group để biến ngôn ngữ tự nhiên thành thao tác CRUD thật trên DB; emotion chạy model ONNX nhẹ trên Lambda."

> Visual: **§14.3 Agent flow sequence** (BFF → Bedrock → action-handler → Supabase) + **§14.4 Emotion sequence**.

---

### Slide 8 — Tính năng AI (2/2): RAG, Report & Embedding

- **RAG (`/rag`):** map emotion → query vector → `search_similar_chunks()` (pgvector cosine) → `[{id,title,source,type}]`
- **Report (`/report`):** `{md_content,user_id,date}` → S3 upload + Pandoc→PDF + SES email → `{markdown_url,pdf_url}`
- **Embedding (`/embed`, `/embed-all`):** sentence-transformers 384d đa ngữ → upsert `media_chunks`
- **Report tự động:** EventBridge cron `59 16 * * ? *` sinh report cuối ngày cho toàn user

*Speaker note:* "RAG và embedding bắt buộc CÙNG model embedding để cosine có nghĩa — đây là điểm em chú ý nhất khi tích hợp."

> Visual: **§14.5 RAG retrieval flow** (query embed → pgvector → ranked results) + **§14.6 Report sequence**.

---

### Slide 9 — Dữ liệu & Knowledge Base

- **KB lưu trong Supabase** (`media_library` + `media_chunks`), KHÔNG dùng S3 — đủ cho quy mô <10 user
- `media_library.type` (5 giá trị: quote, sutra, video, article, audio); `embedding_vector VECTOR(384)` + ivfflat cosine
- **Embedding đa ngữ:** `paraphrase-multilingual-MiniLM-L12-v2` (giữ 384d) — tốt cho lời dạy tiếng Việt
- **Ingestion pipeline (E4):** crawl → clean → chunk → embed → upsert `media_chunks`; lưu `source`, `language`, `model_name`
- Lưu ý bản quyền nguồn cào (vd Dipkar / Khangser Rinpoche)

*Speaker note:* "Em chọn pgvector thay vì vector DB riêng vì quy mô nhỏ — tiết kiệm và ít hạ tầng phải vận hành."

> Visual: **§14.8 ER diagram** (`media_library`↔`media_chunks`) + **§14.7 Embedding sequence** (ingestion/vectorize flow).

---

### Slide 10 — Bảo mật

- **RLS là biên giới an ninh duy nhất** (route `ssr:false`) — đã vá lỗ hổng leo quyền: thêm `WITH CHECK` cấm user tự đổi `role`/`status`
- **JWT authorizer** ở API Gateway: verify Supabase access_token; wrapper `$fetch` gắn `Bearer <access_token>` cho cả 5 call AI (thay cho bug `Bearer = userId` cũ)
- Cân nhắc **custom Lambda authorizer** nếu Supabase phát HS256
- **service_role + JWT secret** chuyển vào **Secrets Manager** (không để plaintext `os.environ`)
- Siết INSERT `daily_worklogs`/`daily_stats` về `service_role`; gate/xóa demo credentials

*Speaker note:* "Bug nghiêm trọng nhất em phát hiện: client gửi UUID thay vì JWT → mọi AI 401; và RLS thiếu WITH CHECK cho phép leo quyền admin. Cả hai đã xử lý."

> Visual: **§14.9 Auth & approval flow** (token path) + ghi chú trust boundary (client ↔ RLS ↔ service_role).

---

### Slide 11 — Deployment (Amplify + AWS, hướng tới CI/CD)

- **Amplify Hosting:** `amplify.yml` (appRoot `web`, `npm run generate`, baseDirectory `.output/public`) + SPA redirect 200 → `/index.html`
- Env build-time: `NUXT_PUBLIC_SUPABASE_URL/ANON_KEY/API_GATEWAY_URL/APP_URL`
- **AWS:** API Gateway + 6 Lambda + 2 Layer (onnx / sentence-transformers) + Bedrock + S3/SES/EventBridge
- **Hướng tới CI/CD:** GitHub Actions (npm, `.output/`) + IaC (SAM/Terraform) thay `deploy.sh` lẻ
- Lead-time sớm: Bedrock **model access** + SES **thoát sandbox** (24–48h)

*Speaker note:* "Hai việc lead-time là model access và SES sandbox — em khởi động sớm song song để không nghẽn lịch deploy."

> Visual: **§14.2 Deployment/topology diagram** (Amplify ↔ API GW ↔ Lambda/Bedrock/Supabase).

---

### Slide 12 — Testing & Kết quả

- **Smoke test từng route** bằng `curl` + access_token thật TRƯỚC khi nối FE (§16.2, S0–S6)
- **End-to-end:** agent (tạo/sửa/xóa) → emotion → RAG (sau ingest KB) → report (S3+email) → embed/embed-all (§16.4 E2E-1..8)
- **Acceptance criteria** AC-1..14 + cổng an ninh AC-13/AC-14 (§16.6)
- Bảng kết quả pass/fail theo từng tính năng (điền sau khi test prod Ngày 9)
- Focus timer test edge: tab nền, pause/resume, hết giờ + Notification

*Speaker note:* "Em test theo nguyên tắc: backend pass bằng curl trước, rồi mới wiring FE — để cô lập lỗi auth/route khỏi lỗi UI."

> Visual: bảng checklist pass/fail (xanh/đỏ) trích từ §16.7. Không cần diagram §14.

---

### Slide 13 — Chi phí / Free-tier

- **Bedrock KHÔNG free-tier** (tính theo token) → nguồn chi phí lớn nhất, cần theo dõi
- Lambda ONNX/sentence-transformers 512–1024MB + cold start → ăn nhanh 400k GB-s free
- **KB pgvector trên Supabase** (không S3) → tiết kiệm cho quy mô nhỏ
- CloudWatch đặt **log retention** để tránh chi phí tích lũy
- Tránh NAT cost: dùng supabase-py REST thay vì psycopg2 qua VPC

*Speaker note:* "Chi phí bất ngờ nhất là Bedrock theo token và CloudWatch không đặt retention — em đã liệt kê biện pháp giảm thiểu."

> Visual: bảng chi phí ước tính theo dịch vụ (free-tier vs phát sinh). Không cần diagram.

---

### Slide 14 — Thách thức & Bài học

- **Layer >250MB** (sentence-transformers + torch) → giải bằng container-image Lambda / weights từ S3
- **Pandoc trong Lambda:** runtime không có sẵn → đóng gói qua layer/container-image
- **JWT authorizer**: native JWKS vs Supabase HS256 → quyết định cơ chế authorizer trước khi code FE
- **Contract drift** 3-way (FE/openapi/lambda) → chốt MỘT nguồn sự thật
- **Fallback im lặng** che lỗi backend → phải surface lỗi trước khi fallback

*Speaker note:* "Bài học lớn nhất: fallback im lặng nguy hiểm vì nó giấu lỗi 401/404 — em đã đổi sang log/surface lỗi."

> Visual: bảng "Thách thức → Giải pháp" 5 dòng (trích §10 risk table).

---

### Slide 15 — Hướng phát triển

- Hoàn thiện 4 Lambda còn README-only (emotion, rag, embed, report) + 2 layer
- **`focus-ai-suggestions` (A5)** thật (Bedrock InvokeModel) thay chuỗi tĩnh client — **đã DEFER ngoài phạm vi 2 tuần** (§12)
- Mở rộng KB ingestion đa ngữ + cải thiện chất lượng tiếng Việt (hnsw index)
- **CI/CD + IaC** đầy đủ (GitHub Actions + SAM/Terraform), observability (alarm, X-Ray, DLQ)
- Mở đăng ký công khai sau khi hoàn tất hardening RLS & SES thoát sandbox

*Speaker note:* "Roadmap ưu tiên: đóng 4 lambda còn thiếu để 100% tính năng AI live, rồi tới CI/CD và observability."

> Visual: roadmap timeline (Now / Next / Later). Tham chiếu §7 lộ trình & §5 mã A1–F3.

---

### Slide 16 — Q&A / Cảm ơn

- Tóm tắt 1 dòng: SPA focus + 5 AI feature, deploy Amplify + AWS, bảo mật RLS/JWT
- Cảm ơn mentor & FCAJ
- Thông tin liên hệ / link repo / link demo
- "Em xin nhận câu hỏi"

*Speaker note:* "Cảm ơn anh/chị đã lắng nghe — em sẵn sàng trả lời câu hỏi, đặc biệt phần kiến trúc AI và bảo mật."

> Visual: slide cảm ơn + QR code repo/demo + ảnh `architecture.png` (§14.1) thu nhỏ.

---

> **Ghi chú dựng slide:** Tổng 16 slide lõi. Có thể tách Slide 5 (kiến trúc) thành 2 slide (logical §14.1 vs deployment §14.2) hoặc tách Slide 9 (data §14.8 vs ingestion §14.7) để đạt ~18–20 slide nếu cần. Mọi diagram tham chiếu §14; ba diagram bắt buộc cho phần kỹ thuật: **Architecture §14.1 (Slide 5)**, **Agent sequence §14.3 (Slide 7)**, **RAG flow §14.5 (Slide 8)**.

---

## 16. Kế hoạch test production & tiêu chí nghiệm thu

> Phạm vi: smoke test API (curl) → unit (vitest) → E2E (Playwright) → Lambda (pytest) → ACCEPTANCE CRITERIA → định nghĩa "production test chạy được". Route/body/response bám **bảng contract §4**; mã hạng mục bám **§5 (A1–A4, E1–E4)**; lịch test map vào **§12 (theo Ngày)**. Hạ tầng test (vitest/Playwright/pytest/`scripts/smoke.sh`) được dựng ở **Ngày 1 (§12)**. Mọi smoke test production cần `ACCESS_TOKEN` = Supabase JWT thật (`session.access_token`) — KHÔNG dùng `user.id` (xem P0 §4). Tài khoản test prod (user approved + admin) tạo ở **Ngày 8 (§12)** vì demo creds `00005` đã bị gate/xóa.

---

### 16.1 Chuẩn bị môi trường test

```bash
# Lấy access_token thật từ Supabase — dùng TÀI KHOẢN TEST PROD tạo ở Ngày 8 (§12)
# (demo creds §00005 đã bị gate/xóa — KHÔNG dùng được nữa)
export SUPABASE_URL="https://<project>.supabase.co"
export SUPABASE_ANON_KEY="<anon key>"
export API="https://<api-id>.execute-api.<region>.amazonaws.com/<stage>"

export ACCESS_TOKEN=$(curl -s "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"<test-user-approved>","password":"<password>"}' | jq -r .access_token)

echo "$ACCESS_TOKEN" | cut -c1-20   # phải in ra "eyJ..." (JWT), KHÔNG phải UUID
```

| Biến | Nguồn | Lưu ý |
|---|---|---|
| `ACCESS_TOKEN` | `POST /auth/v1/token?grant_type=password` (user test approved) | JWT bắt đầu `eyJ`; hết hạn ~1h → lấy lại nếu 401 |
| `ADMIN_TOKEN` | login admin test (tạo Ngày 8) | dùng cho `/embed`, `/embed-all` (admin gate §9.5) |
| `USER_ID` | claim `sub` của token | dùng cho body `/report` |

---

### 16.2 Smoke test từng API route (curl)

Header chung mọi lệnh: `-H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json"`.
Mỗi route kèm: **mục đích PASS** = đúng HTTP 200 + shape response khớp §4 (kiểm bằng `jq`). Lỗi 401 = authorizer/JWT sai (P0 §4); 404 = route drift (P0 §4); 5xx = lambda/secret.

#### S1 — Agent chat `/agent/chat` (POST)
```bash
curl -sS -X POST "$API/agent/chat" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '{"sessionId":"smoke-1","inputText":"Tạo task ôn thi vật lý ưu tiên cao"}' | jq .
```
- **Expected:** `200` · `{sessionId, responseText, tasks?, followUpQuestions?, actionTaken?}`. `responseText` non-empty; nếu agent tạo task thì `actionTaken="create-task"` và task xuất hiện trong Supabase.
- **PASS khi:** `jq -e '.responseText|length>0'` thành công.

#### S2 — Emotion `/emotion` (POST) — A1
```bash
curl -sS -X POST "$API/emotion" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '{"text":"Tôi quá mệt và áp lực, không tập trung nổi"}' | jq .
```
- **Expected:** `200` · `{label, confidence}`. `label ∈ {focused, stressed, exhausted, relaxed, unmotivated}`; `0 ≤ confidence ≤ 1`.
- **PASS khi:** `jq -e '.label and (.confidence>=0 and .confidence<=1)'`.

#### S3 — RAG `/rag` (POST) — A2
```bash
curl -sS -X POST "$API/rag" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '{"emotion":"stressed","limit":3}' | jq .
```
- **Expected:** `200` · mảng `[{id,title,source,type,...}]`, length `≤ limit`. (Điều kiện: KB đã ingest+embed E4; rỗng nếu chưa.)
- **PASS khi:** `jq -e 'type=="array" and length>=1'` (sau khi seed KB — Ngày 7b/buffer).

#### S4 — Report `/report` (POST) — A4
```bash
curl -sS -X POST "$API/report" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d "{\"md_content\":\"# Worklog\\n- demo\",\"user_id\":\"$USER_ID\",\"date\":\"2026-06-29\"}" | jq .
```
- **Expected:** `200` · `{markdown_url, pdf_url, message}`; `markdown_url` là URL S3 truy cập được (`curl -I` → 200).
- **PASS khi:** `jq -e '.markdown_url|startswith("http")'` và `curl -sI "$(...markdown_url)" | head -1` = 200.

#### S5 — Embed 1 media `/embed` (POST) — A3 (ADMIN)
```bash
curl -sS -X POST "$API/embed" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"mediaId":"<media_library.id>"}' | jq .
```
- **Expected:** `200` · `{ok}` (`ok=true`); sau đó `media_library.embedding_vector` của id đó khác NULL.
- **PASS khi:** `jq -e '.ok==true'` và verify vector trong Supabase.

#### S6 — Embed batch `/embed-all` (POST) — A3 (ADMIN)
```bash
curl -sS -X POST "$API/embed-all" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{}' | jq .
```
- **Expected:** `200` · `{count}` = số media được embed (≥0).
- **PASS khi:** `jq -e '.count|type=="number"'`.

#### S0 — Negative/auth smoke (chạy cho MỌI route)
```bash
# Không token → phải 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$API/emotion" -d '{"text":"x"}'   # kỳ vọng 401
# Token sai (UUID) → phải 401 (chống regression P0)
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$API/emotion" \
  -H "Authorization: Bearer 00000000-0000-0000-0000-000000000000" -d '{"text":"x"}' # kỳ vọng 401
# OPTIONS preflight → 200/204 + ACAO = domain Amplify (CORS P1 §4)
curl -s -o /dev/null -w "%{http_code}\n" -X OPTIONS "$API/emotion" \
  -H "Origin: https://<amplify-domain>" -H "Access-Control-Request-Method: POST"      # kỳ vọng 200/204
```

**Bảng tổng smoke:**

| ID | Route | Method | Body | Expected (200) | PASS check |
|---|---|---|---|---|---|
| S1 | `/agent/chat` | POST | `{sessionId,inputText}` | `{sessionId,responseText,tasks?,followUpQuestions?,actionTaken?}` | `responseText` non-empty |
| S2 | `/emotion` | POST | `{text}` | `{label,confidence}` | label hợp lệ, conf∈[0,1] |
| S3 | `/rag` | POST | `{emotion,limit}` | `[{id,title,source,type,...}]` | array len 1..limit |
| S4 | `/report` | POST | `{md_content,user_id,date}` | `{markdown_url,pdf_url,message}` | url S3 trả 200 |
| S5 | `/embed` | POST | `{mediaId}` | `{ok}` | `ok==true` + vector!=NULL |
| S6 | `/embed-all` | POST | `{}` | `{count}` | count là number |
| S0 | (mọi route) | -/OPTIONS | — | 401 / preflight 200 | auth + CORS đúng |

---

### 16.3 Unit test (vitest) — `npm test`

Test thuần logic store/composable (mock Supabase client). File đặt cạnh source: `web/stores/__tests__/*.spec.ts`, `web/composables/__tests__/*.spec.ts`. (Hạ tầng vitest + `web/vitest.config.ts` dựng ở Ngày 1 §12.)

> **Tên symbol bám CHÍNH XÁC code thật:** `task.store` dùng `toggleTask(taskId)` (KHÔNG có `toggle()`), state review là `reviewTarget: Task|null` (KHÔNG phải `pendingReviewTaskId`). `focus.store` expose `taskId: ref<string|null>` (KHÔNG có `currentTaskId`); `endAt` là biến module-local (`let`, KHÔNG expose ra store) ⇒ assert qua `status`/`remaining` + `vi.setSystemTime`, KHÔNG assert `endAt` trực tiếp.

#### U1 — `task.store.ts`
| Case | Setup | Assert |
|---|---|---|
| U1.1 requestToggle mở review | task `in_progress`, không khóa | gọi `requestToggle(id)` → state review dialog mở, `reviewTarget?.id===id` (và `reviewText`), task CHƯA `completed` |
| U1.2 requestToggle bị chặn khi khóa | task gắn focus đang chạy → `isLockedByFocus(id)===true` | `requestToggle(id)` no-op (không mở review, không đổi status) |
| U1.3 isLockedByFocus | `focusStore.taskId===id`, status running/paused | `isLockedByFocus(id)===true`; id khác → `false` |
| U1.4 TaskLockedError | `toggleTask`/đổi field task đang khóa (path không phải completed) | `expect(() => toggleTask(id)).toThrow(TaskLockedError)`; `err.name==='TaskLockedError'` |
| U1.5 Completed chỉ sửa review | task `completed`, edit title | title KHÔNG đổi; chỉ `review` cập nhật (theo §44 state) |

```ts
// trích kỳ vọng load-bearing (tên thật trong code):
expect(() => store.toggleTask(lockedId)).toThrow(TaskLockedError)
expect(store.isLockedByFocus(lockedId)).toBe(true)
expect(store.reviewTarget?.id).toBe(id)   // KHÔNG có pendingReviewTaskId
```

#### U2 — `focus.store.ts`
| Case | Setup | Assert |
|---|---|---|
| U2.1 start neo qua thời gian | `start(1500, taskId,...)` với `vi.useFakeTimers()`+`vi.setSystemTime` | `remaining===1500`; advance `Date.now` +10s rồi tick → `remaining===1490` (neo theo `endAt` nội bộ, không trôi) |
| U2.2 endEarly | đang running, còn 1200s | `endEarly()` → `status==='finished'`; `remaining` = phần còn lại tại thời điểm gọi (KHÔNG assert `endAt` — không expose) |
| U2.3 pause/resume giữ remaining | running → `pause()` (advance 30s thực) → `resume()` | sau pause `remaining` đóng băng; sau resume tiếp tục đếm đúng theo `remaining` (không trừ thời gian pause) |
| U2.4 finish | timer chạy hết (advance qua hết duration) | `status==='finished'`, `remaining===0` (KHÔNG assert `endAt` — kiểm qua `status`/`remaining`) |

> Dùng `vi.useFakeTimers()` + `vi.setSystemTime()` để kiểm cơ chế neo (qua tick/`displayTime`) — KHÔNG phụ thuộc `setInterval` thực, và KHÔNG truy cập `endAt` trực tiếp (biến module-local, không nằm trong return của store).

#### U3 — `useAuth.ts`
| Case | Setup (mock `supabase.auth` + `from('users')`) | Assert |
|---|---|---|
| U3.1 pending bị chặn | login OK, `users.status='pending'`, không admin | throw `'pending admin approval'` + gọi `auth.signOut()` |
| U3.2 rejected bị chặn | `status='rejected'` | throw `'rejected'` + `signOut()` |
| U3.3 approved vào được | `status='approved'` | trả user, KHÔNG signOut |
| U3.4 admin bypass | `role='admin'`, `status='pending'` | vào được, `status` hiệu lực `'approved'` |
| U3.5 approveUser/rejectUser | gọi với userId | `from('users').update({status:'approved'\|'rejected'}).eq('id',userId)` được gọi đúng |

---

### 16.4 E2E (Playwright) — `npx playwright test`

Chạy trên build production (`nuxt generate` preview) hoặc URL Amplify thật. Config `web/playwright.config.ts`, spec `web/e2e/*.spec.ts`. (Hạ tầng Playwright dựng ở Ngày 1 §12.)

| ID | Kịch bản | Bước chính | Expected |
|---|---|---|---|
| E2E-1 | Login + approval gate | login user `pending` → login user `approved` | pending: thấy thông báo "pending admin approval", KHÔNG vào `/dashboard`; approved: redirect `/dashboard` |
| E2E-2 | Tạo task (tay) | `/tasks` → "+ Add Task" → nhập title/priority → save | task mới hiện ở section **Pending**, status `pending` |
| E2E-3 | Tạo task (Agent) | `/agent` → gửi "tạo task X" → chờ phản hồi | bong bóng agent trả lời; task X xuất hiện ở Pending (qua action-handler) |
| E2E-4 | Focus session real-time | `/focus` → chọn task `in_progress` → Start → đợi/tua | countdown neo theo thời gian thực chạy; cấp quyền Notification; hết giờ → chime + Notification + màn Session Complete |
| E2E-5 | Review-on-complete | tick task `in_progress` ở `/tasks` (và widget `/dashboard`) | mở `TaskReviewDialog` "How was this task?"; lưu review → task chuyển **Completed** |
| E2E-6 | Khóa task khi focus | start focus gắn task → quay `/tasks` tick task đó | hiện 🔒, tick bị chặn (TaskLockedError, không completed) |
| E2E-7 | RAG gợi ý | `/focus` → Session Complete → nhập journal "stressed" | panel gợi ý nội dung hiển thị item từ `/rag` (cần KB ingest E4) |
| E2E-8 | Export report | `/dashboard` → `ExportReportButton` → Export | tải `.md` hoặc nhận `{markdown_url}` (mở được); toast thành công |

> Notification trong E2E-4: dùng `context.grantPermissions(['notifications'])`. Timer: rút `duration` xuống (vd 5s) qua tham số test hoặc dùng `page.clock` để tua, tránh chờ thực 25 phút.

---

### 16.5 Lambda test (pytest)

Mỗi lambda có `tests/test_handler.py`; mock Bedrock/Supabase bằng `unittest.mock`/`moto`. Test bằng event API Gateway giả (đúng claim shape đã pin §4 — `jwt.claims.sub` nếu HTTP API v2). (pytest + `requirements-dev.txt` per-lambda dựng ở Ngày 1 §12.)

| ID | Lambda | Case | Assert |
|---|---|---|---|
| L1 | `agent-bff` | event hợp lệ | gọi `invoke_agent` đúng `BEDROCK_AGENT_ID/ALIAS_ID`; trả `{sessionId,responseText,...}`; CORS header trên response |
| L2 | `agent-bff` | body lỗi / thiếu `inputText` | trả 4xx có CORS (try/except hardening P1 §4), KHÔNG 500 trần |
| L3 | `agent-bff` | đọc user từ claim | `user_id` lấy từ `event...claims.sub`, KHÔNG từ body |
| L4 | `agent-action-handler` | apiPath `/create-task` | upsert Supabase đúng payload; trả shape action-group; gắn `user_id` |
| L5 | `agent-action-handler` | `/update-task`,`/delete-task` | route đúng theo apiPath+method; lỗi → trả message |
| L6 | `emotion-detector` (A1) | `{text}` | `{label,confidence}`; label ∈ 5 nhãn; conf∈[0,1] |
| L7 | `rag-recommender` (A2) | `{emotion,limit}` | embed query CÙNG model; gọi `search_similar_chunks` (`*` hàm MỚI E2, KHÔNG phải `search_similar_content`); trả `≤limit` item |
| L8 | `admin-vectorizer` (A3) | `/embed {mediaId}` & `/embed-all {}` | upsert `embedding_vector`/`media_chunks`; trả `{ok}` / `{count}`; chặn non-admin |
| L9 | `report-generator` (A4) | `{md_content,user_id,date}` | upload S3 (moto), gọi SES, trả `{markdown_url,pdf_url,message}`; Pandoc→PDF qua layer/container |

---

### 16.6 ACCEPTANCE CRITERIA (Input → Expected → Pass/Fail)

| # | Tính năng | Input | Expected | Pass/Fail |
|---|---|---|---|---|
| AC-1 | Approval gate | login user `status=pending` | bị chặn + thông báo pending; admin approve → login lại vào `/dashboard` | PASS nếu cả 2 nhánh đúng |
| AC-2 | Tạo task tay | "+ Add Task" title="Đọc sách" | task hiện ở Pending, `status='pending'`, không due_date trong form | PASS nếu đúng section+status |
| AC-3 | Tạo task qua Agent | chat "tạo task đọc sách ưu tiên cao" | agent phản hồi + task xuất hiện Pending (priority cao) | PASS nếu task tạo thật trong DB |
| AC-4 | Focus timer real-time | Start 25:00, chuyển tab 10s rồi quay lại | đồng hồ tự hiệu chỉnh đúng (sai lệch ≤1s), không trôi | PASS nếu khớp thời gian thực |
| AC-5 | Notification hết giờ | timer chạy hết (test 5s) | chime WebAudio + Notification trình duyệt; bấm → focus tab | PASS nếu cả chime+notif |
| AC-6 | Review-on-complete | tick task in_progress | mở dialog review trước; lưu → Completed | PASS nếu phải review trước khi xong |
| AC-7 | Khóa task khi focus | tick task đang gắn focus chạy | 🔒, không completed (TaskLockedError) | PASS nếu bị chặn |
| AC-8 | Completed lock fields | edit task completed | chỉ `review` sửa được; title/priority/status khóa | PASS nếu field khác bất biến |
| AC-9 | Emotion detect | journal "mệt mỏi áp lực" | trả label hợp lệ (vd stressed/exhausted) + confidence | PASS nếu label∈5 nhãn |
| AC-10 | RAG gợi ý | emotion=stressed (KB đã ingest E4) | ≥1 gợi ý có title+source | PASS nếu list non-empty & đúng emotion |
| AC-11 | Export report | Export ngày 2026-06-29 | `markdown_url` mở được (prod) / `.md` tải về (fallback) | PASS nếu file mở/tải được |
| AC-12 | Embed media | admin `/embed mediaId` | `embedding_vector` != NULL sau gọi | PASS nếu vector ghi vào DB |
| AC-13 | Auth biên giới | gọi AI không token / token UUID | 401 mọi route | PASS nếu đều 401 |
| AC-14 | RLS leo quyền | user tự `UPDATE role='admin'` | bị RLS từ chối (WITH CHECK) | PASS nếu update fail |

---

### 16.7 Định nghĩa "production test chạy được"

Coi là ĐẠT khi TẤT CẢ dòng dưới PASS **trên môi trường production thật** (Amplify domain + API Gateway stage + Supabase prod + AWS prod). Mỗi feature = smoke + đúng **1 happy path**. (Map vào §7 GĐ10 = **Ngày 9 §12**.)

**Smoke (prod) — bắt buộc 100%:**
- [ ] S0 auth: không token → 401; token UUID → 401; OPTIONS preflight → 200/204 + ACAO domain Amplify
- [ ] S1 `/agent/chat` 200 + `responseText`
- [ ] S2 `/emotion` 200 + label hợp lệ
- [ ] S3 `/rag` 200 + ≥1 item (KB đã ingest E4)
- [ ] S4 `/report` 200 + `markdown_url` mở được
- [ ] S5 `/embed` 200 + vector ghi DB · S6 `/embed-all` 200 + count

**1 happy path / feature (prod):**
- [ ] Login approved → vào `/dashboard` (AC-1)
- [ ] Tạo task tay (AC-2) · Tạo task qua Agent (AC-3)
- [ ] Focus session: Start → hết giờ → chime + Notification → Session Complete (AC-4, AC-5)
- [ ] Review-on-complete → Completed (AC-6)
- [ ] Khóa task khi focus 🔒 (AC-7)
- [ ] Emotion + RAG hiển thị gợi ý (AC-9, AC-10)
- [ ] Export report (AC-11)
- [ ] Admin embed media → vector trong DB (AC-12)

**Cổng an ninh (bắt buộc, không có ngoại lệ):**
- [ ] AC-13 mọi route AI 401 khi thiếu/sai JWT
- [ ] AC-14 user KHÔNG tự leo `role/status` (RLS `WITH CHECK`)

> "Chạy được" = toàn bộ checkbox trên xanh. Nếu RAG rỗng vì KB chưa ingest → đánh dấu **BLOCKED (E4)**, không tính FAIL nhưng phải seed KB (Ngày 7b/buffer §12) trước khi nghiệm thu cuối.

---

### 16.8 Lệnh chạy

```bash
# Unit (vitest) — trong web/ (vitest + config dựng ở Ngày 1 §12)
cd web && npm test                      # toàn bộ; npm test -- task.store để chạy 1 file
npm test -- --coverage                  # kèm coverage

# E2E (Playwright) — trong web/
npx playwright install --with-deps      # lần đầu
npx playwright test                      # toàn bộ headless
npx playwright test --ui                 # debug
npx playwright test --grep "@smoke"      # chỉ smoke E2E
BASE_URL=https://<amplify-domain> npx playwright test   # test prod thật

# Lambda (pytest) — mỗi thư mục aws/lambdas/<fn>/
cd aws/lambdas/agent-bff && pip install -r requirements-dev.txt && pytest -q
pytest aws/lambdas -q                    # toàn bộ lambda (từ root, nếu cấu hình)

# Smoke API (curl) — sau khi export ACCESS_TOKEN (16.1)
bash scripts/smoke.sh                    # gói S0–S6 thành 1 script, exit!=0 nếu có FAIL
```

---

### 16.9 Map đợt test vào lịch §12

> Quy đổi tường minh Giai đoạn §7 → Ngày §12 để mỗi đợt test neo vào một Ngày cụ thể.

| Đợt test | Phụ thuộc | Giai đoạn §7 | **Ngày §12** |
|---|---|---|---|
| Dựng test tooling (vitest/Playwright/pytest/smoke.sh) | — | — | **Ngày 1** (nửa ngày, song song P0) |
| Unit U1–U3 (vitest) | chỉ FE logic | — | **Ngày 1–2** (song song khi sửa store/composable) |
| Lambda L1–L5 (`agent-bff`/action-handler) | sau hardening agent-bff | GĐ4 | **Ngày 5** |
| Lambda L6–L9 (A1–A4) | sau khi code 4 lambda mới | — | **Ngày 4–5, 7** (ngay sau mỗi lambda xong) |
| Smoke S0–S6 (curl) | sau deploy API GW + JWT authorizer | GĐ6 | **Ngày 6** (trước khi nối FE) |
| E2E-1..3,5,6,8 (không cần KB) | sau FE wiring + Amplify | GĐ8–9 | **Ngày 8–9** |
| E2E-4 (timer/Notification) | sau FE wiring | GĐ8 | **Ngày 8–9** |
| E2E-7 + AC-10 (RAG) | sau ingest KB (E4) | GĐ10 | **Ngày 9** (sau Ngày 7b/buffer; gate BLOCKED nếu KB chưa xong) |
| Cổng an ninh AC-13/AC-14 | sau vá RLS + JWT | GĐ1 + GĐ8 | **Ngày 9** (chốt trước nghiệm thu) |
| "Production test chạy được" (16.7) đầy đủ | toàn bộ deploy xong | GĐ10 | **Ngày 9** (nghiệm thu, trước nộp + slide Ngày 10) |
