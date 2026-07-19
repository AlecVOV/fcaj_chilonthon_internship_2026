# Supabase — Backend-as-a-Service

This folder contains everything needed to set up the Focus Mode App's
Supabase backend: database schema, RLS policies, and Edge Functions.

## What's Inside

| Path | Purpose |
|------|---------|
| `migrations/` | Sequential SQL migrations (`00001`–`00017`): schema, triggers, demo accounts, user-approval flow, hardening, ambient sounds, agent chat history + rate limit, embedding dimension 384→1024 (Cohere), fix bug `search_similar_content()`, bảng `feedback` (user gửi phản hồi, admin đọc qua CMS) |
| `rls_policies.sql` | Row Level Security policies for all tables |
| `check_and_fix_users.sql` | Script kiểm tra/vá dữ liệu `public.users` (chạy tay khi cần) |
| `migrations/nuke_all.sql` | ⚠️ Xóa sạch data để test lại từ đầu — KHÔNG chạy trên production |

## Quick Start

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → run the files in `migrations/` in order (`00001` → `00017`)
3. Run `rls_policies.sql` to enable RLS
4. Get API keys from Settings → API and add to `web/.env`

> Migration chạy **thủ công** (không có CI) — mỗi khi thêm migration mới, cập nhật
> `docs/PROJECT_STATE.md` để track đã chạy hay chưa.

## Database Tables

| Table | Purpose |
|-------|---------|
| `users` | Mirrors `auth.users`; holds role + approval `status` (pending/approved/rejected) |
| `tasks` | To-do list items with review column + `priority`/`status`/`due_date` |
| `focus_sessions` | Pomodoro/focus session records with emotion labels |
| `daily_worklogs` | Nightly aggregated stats (Lambda writes, user reads) |
| `daily_stats` | Stats hàng ngày theo user (streak, tasks_created, ...) |
| `media_library` | RAG content: sutras, quotes, videos with pgvector embeddings — **`embedding_vector VECTOR(1024)`** (đổi từ 384 ở migration `00015`, dùng Bedrock Cohere Embed Multilingual v3 qua Lambda `admin-vectorizer`, **đã có data thật embed**) |
| `ambient_sounds` | Danh sách nhạc nền hiển thị ở trang Focus (CRUD qua Admin, file thật ở S3) — migration `00013` |
| `agent_conversations` | Lịch sử các đoạn chat với AI Task Assistant (1 user nhiều đoạn) — migration `00014` |
| `agent_messages` | Từng tin nhắn trong 1 `agent_conversations` (role user/agent) — migration `00014` |
| `agent_daily_usage` | Đếm số lượt gọi AI/user/ngày để giới hạn (`AGENT_DAILY_LIMIT`) — migration `00014` |
| `feedback` | Feedback user gửi từ trang Profile (`message`, `status` `new`/`read`/`resolved`); RLS user chỉ thấy/gửi dòng của mình, admin đọc + đổi status tất cả — migration `00017` |
| `sync_log` | ⚠️ Còn trong schema (migration `00001`) nhưng **không còn code nào dùng** — tàn dư kiến trúc offline-sync cũ đã gỡ; cân nhắc drop trong migration sau nếu chắc chắn không cần |

## Functions đáng chú ý

| Function | Purpose |
|---|---|
| `search_similar_content(query_embedding VECTOR(1024), match_threshold, match_count, filter_type)` | RPC cosine-similarity search trên `media_library` (dùng bởi Lambda `rag-recommender`). Chữ ký gốc ở migration `00001` (384-dim), đổi chiều ở `00015`. **Migration `00016` fix bug thật**: cột `similarity` khai `REAL` nhưng biểu thức `<=>` trả `DOUBLE PRECISION` → Postgres từ chối query (`42804`) ngay khi có ≥1 dòng khớp — bug có sẵn từ `00001`, chỉ lộ ra khi RPC được gọi thật lần đầu (2026-07-13). SECURITY INVOKER mặc định nên chạy dưới quyền caller, RLS `media_read_all` vẫn áp dụng. |
| `is_admin()` | Dùng trong RLS mọi bảng cần phân quyền admin — migration `00006` |

## Post-Deploy Check

- [ ] Run `SELECT * FROM auth.users;` — should be empty (no users yet)
- [ ] Run `SELECT * FROM public.media_library;` — should be empty
- [ ] Run `SELECT id, email, role, status FROM public.users;` — admin rows should be `approved`
- [ ] Run `SELECT id, embedding_vector IS NOT NULL AS embedded FROM public.media_library;` — verify ít nhất 1 dòng `embedded = true` sau khi chạy `admin-vectorizer` `/embed`/`/embed-all`
