-- ============================================================================
-- check_and_fix_users.sql
-- Chẩn đoán & sửa lỗi "đăng ký rồi nhưng admin panel không thấy user để approve".
-- Chạy từng phần trong Supabase → SQL Editor.
-- ============================================================================

-- ── BƯỚC 1: Cột `status` đã tồn tại chưa? (nếu rỗng → CHƯA chạy 00006) ───────
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'status';
--  → Không có dòng nào = bạn CHƯA chạy 00006_user_approval_status.sql.
--    Hãy mở file đó, copy toàn bộ, chạy, rồi quay lại bước 2.


-- ── BƯỚC 2: Xem toàn bộ user trong public.users ─────────────────────────────
SELECT id, email, role, status, created_at
FROM public.users
ORDER BY created_at DESC;
--  → Nếu user vừa đăng ký KHÔNG xuất hiện ở đây: trigger handle_new_user chưa
--    chạy (chưa chạy 00003/00005/00006). Chạy lại 00006 (đã gồm trigger).
--  → Nếu có nhưng status = NULL: cột vừa thêm chưa backfill — chạy bước 4.


-- ── BƯỚC 3: Tài khoản ADMIN của bạn có role='admin' trong DB không? ──────────
-- RLS chỉ cho admin (role='admin' trong public.users) đọc user khác.
-- Nếu admin của bạn role='user', frontend vẫn vào được panel (nhờ ADMIN_EMAILS)
-- nhưng DB chặn → pending list rỗng / báo lỗi.
SELECT email, role, status FROM public.users WHERE role = 'admin';
--  → Nếu email admin của bạn KHÔNG nằm ở đây → chạy bước 4.


-- ── BƯỚC 4: SỬA — nâng các email admin lên role='admin' + approved ───────────
-- (Khớp danh sách trong web/.env → ADMIN_EMAILS)
UPDATE public.users
SET role = 'admin', status = 'approved'
WHERE email IN (
  'lehoangtrietthong@gmail.com',
  'lehoangtrietthong2102004@gmail.com',
  'lhtthong.forwork@outlook.com',
  'lhtthong.forwork@gmail.com',
  'admin@focusmode.app'
);


-- ── BƯỚC 5: (tuỳ chọn) Kiểm tra hàm is_admin() đã có chưa ────────────────────
SELECT proname FROM pg_proc WHERE proname = 'is_admin';
--  → Rỗng = chưa chạy 00006.


-- ── BƯỚC 6: Xác nhận lại — phải thấy user pending ───────────────────────────
SELECT email, role, status FROM public.users WHERE status = 'pending';
-- Sau đó vào admin panel (đăng nhập lại bằng tài khoản admin) → sẽ thấy ở "Pending".
-- ============================================================================
