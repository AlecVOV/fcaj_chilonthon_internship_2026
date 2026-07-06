-- ============================================================================
-- 00011_sync_user_email.sql
-- Đồng bộ public.users.email theo auth.users.email mỗi khi email đổi.
--
-- Vấn đề: đổi email cập nhật auth.users.email (danh tính đăng nhập), NHƯNG
-- public.users.email (mirror dùng cho hiển thị + admin dashboard) KHÔNG tự đổi —
-- vì trigger handle_new_user chỉ chạy khi INSERT. Khi đổi email hoàn tất qua link
-- xác nhận (ngoài luồng app), mirror bị kẹt ở email cũ → admin list hiện sai.
--
-- Giải pháp: trigger AFTER UPDATE trên auth.users → cập nhật public.users.email.
-- Bao MỌI đường đổi email (app / link xác nhận / admin sửa tay ở Dashboard).
--
-- Chạy trong: Supabase → SQL Editor, SAU 00006/00008. Idempotent.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_user_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.users SET email = NEW.email WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_change ON auth.users;
CREATE TRIGGER on_auth_user_email_change
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (NEW.email IS DISTINCT FROM OLD.email)
  EXECUTE FUNCTION public.sync_user_email();

-- Backfill: sửa NGAY các dòng public.users đang lệch với auth.users (gồm cả
-- trường hợp email bạn vừa đổi mà mirror còn cũ).
UPDATE public.users u
SET email = a.email
FROM auth.users a
WHERE a.id = u.id AND u.email IS DISTINCT FROM a.email;

-- Kiểm tra: câu này phải trả về 0 dòng (không còn lệch)
-- SELECT u.id, u.email AS public_email, a.email AS auth_email
-- FROM public.users u JOIN auth.users a ON a.id = u.id
-- WHERE u.email IS DISTINCT FROM a.email;
-- ============================================================================
