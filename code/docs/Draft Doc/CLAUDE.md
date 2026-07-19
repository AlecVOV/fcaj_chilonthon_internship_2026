# Focus Mode App — Hướng dẫn cho Claude

Đây là file chỉ dẫn đến vault bên trong chứa thông tin của project này. Nhiệm vụ của bạn: LUÔN đọc các tài liệu trạng thái dưới đây TRƯỚC khi làm việc để nắm toàn bộ project.

## Đọc trước (bắt buộc, theo thứ tự)
1. **`docs/PROJECT_STATE.md`** — trạng thái chuẩn xác hiện tại (kiến trúc, đã làm gì, vấn đề đang mở, cách tiếp tục).
2. **`Plan_and_Deploy.md`** — lộ trình deploy cloud/AWS + lịch 2 tuần (§12–16) + diagram + PPT + test plan.
3. **`docs/`** — tài liệu kỹ thuật đã đồng bộ với code (sync 2026-06-29).

## Tổng quan nhanh
- Sản phẩm: "Focus Mode App" / "FCAJ Worklog Repository" — **Nuxt 4 SPA** + **Supabase** (Postgres + Auth + pgvector), **cloud-only** (đã gỡ offline-first). 5 tính năng AI dự kiến chạy trên **AWS** (agent chat, emotion, RAG, report, embedding) — phần lớn CHƯA deploy.
- Thư mục: `web/` (frontend) · `supabase/` (DB + migrations + RLS) · `aws/` (lambda/infra) · `docs/` (tài liệu).

## Quy tắc cốt lõi (chi tiết trong PROJECT_STATE.md)
- **Cloud-only**: KHÔNG dùng offline/IndexedDB/Dexie/sync queue (đã gỡ).
- Duyệt user qua cột `public.users.status` + RLS `is_admin()` (KHÔNG dùng `user_requests`/`approve-user`/`profiles` — đã gỡ ở migration 00007).
- Khi đổi code, cập nhật `docs/` tương ứng + `docs/PROJECT_STATE.md`.
- Trả lời người dùng bằng **tiếng Việt**, thuật ngữ kỹ thuật giữ tiếng Anh.
- Xác minh tuyên bố bằng code thật (file:line) trước khi khẳng định.

**Rule:**
