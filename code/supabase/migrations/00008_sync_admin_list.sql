-- ============================================================================
-- 00008_sync_admin_list.sql
-- Đồng bộ danh sách admin về MỘT nguồn duy nhất trong DB.
--
-- Bối cảnh: đã GỠ ADMIN_EMAILS (env override) khỏi frontend. Từ nay admin được
-- xác định DUY NHẤT bằng public.users.role='admin' (khớp RLS is_admin()).
--
-- File này:
--   1) Cập nhật trigger handle_new_user() (single source-of-truth cho admin list;
--      email trong list tự nhận role='admin' khi đăng ký) → fix cho signup TƯƠNG LAI.
--   2) BACKFILL PROFILE (FIX CHÍNH): tạo public.users cho các auth.users CÒN THIẾU
--      (user đã đăng ký nhưng chưa có profile → status='pending' để hiện ở admin panel).
--   3) Promote các email admin lên role='admin' (cho dòng đã tồn tại).
--   4) Kiểm tra lại.
--
-- 👉 TRƯỚC KHI CHẠY: nếu email bạn dùng để đăng nhập admin CHƯA có trong danh sách
--    bên dưới, hãy thêm nó vào CẢ HAI chỗ đánh dấu [ADMIN LIST] (bỏ comment dòng mẫu).
--
-- Chạy trong: Supabase → SQL Editor. An toàn chạy lại nhiều lần (idempotent).
-- Yêu cầu: đã chạy 00006 (có cột status + hàm is_admin()).
-- ============================================================================

-- ── 1. Trigger: single source-of-truth cho admin emails ─────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- [ADMIN LIST] — danh sách email admin (thêm email của bạn nếu cần)
  v_is_admin := lower(NEW.email) = ANY(ARRAY[
    -- 'lehoangtrietthong@gmail.com',
    -- 'lehoangtrietthong2102004@gmail.com',
    -- 'lhtthong.forwork@outlook.com',
    -- 'lhtthong.forwork@gmail.com',
    'admin@focusmode.app'
    -- , 'email-admin-cua-ban@gmail.com'   -- 👈 bỏ comment + đổi thành email của bạn
  ]);

  INSERT INTO public.users (id, email, display_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)),
    CASE WHEN v_is_admin THEN 'admin' ELSE 'user' END,
    CASE WHEN v_is_admin THEN 'approved' ELSE 'pending' END
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Re-attach trigger (an toàn chạy lại)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ── 2. BACKFILL PROFILE: tạo public.users cho MỌI auth.users còn thiếu ──────
-- 👉 ĐÂY LÀ FIX CHÍNH cho lỗi "auth có user nhưng public.users trống / admin
--    panel không thấy pending". Các user đã đăng ký TRƯỚC khi trigger chạy nằm
--    trong auth.users nhưng KHÔNG có dòng public.users → tạo bù ở đây.
--    (user thường → status='pending' để hiện trong "Pending Approval").
INSERT INTO public.users (id, email, display_name, role, status)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data ->> 'display_name', split_part(au.email, '@', 1)),
  CASE WHEN lower(au.email) = ANY(ARRAY['admin@focusmode.app']) THEN 'admin' ELSE 'user' END,
  CASE WHEN lower(au.email) = ANY(ARRAY['admin@focusmode.app']) THEN 'approved' ELSE 'pending' END
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL;

-- ── 3. Promote admin emails (cho các dòng ĐÃ tồn tại) ───────────────────────
-- [ADMIN LIST] — GIỮ KHỚP với danh sách trong trigger ở trên.
UPDATE public.users
SET role = 'admin', status = 'approved'
WHERE lower(email) IN (
  -- 'lehoangtrietthong@gmail.com',
  -- 'lehoangtrietthong2102004@gmail.com',
  -- 'lhtthong.forwork@outlook.com',
  -- 'lhtthong.forwork@gmail.com',
  'admin@focusmode.app'
  -- , 'email-admin-cua-ban@gmail.com'   -- 👈 bỏ comment + đổi thành email của bạn
);

-- ── 4. Kiểm tra lại ─────────────────────────────────────────────────────────
-- (a) Danh sách admin — phải thấy tài khoản admin của bạn ở đây:
SELECT email, role, status FROM public.users WHERE role = 'admin' ORDER BY email;

-- (b) User đang chờ duyệt (đăng nhập bằng admin ở app → sẽ thấy ở "Pending Approval"):
SELECT email, role, status, created_at FROM public.users WHERE status = 'pending' ORDER BY created_at DESC;
-- ============================================================================
