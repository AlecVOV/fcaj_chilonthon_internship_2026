-- ============================================================================
-- 00009_harden_db.sql
-- Vá các vấn đề bảo mật / toàn vẹn dữ liệu ở tầng DB (không liên quan AI).
--
-- Gồm:
--   1) Chặn user tự nâng role/status (privilege escalation) — bằng TRIGGER
--      (không dùng WITH CHECK vì WITH CHECK vẫn pass khi id không đổi).
--   2) Gỡ policy INSERT `WITH CHECK(TRUE)` trên daily_worklogs/daily_stats
--      (đang cho MỌI user chèn số liệu giả). service_role vẫn ghi được (bypass RLS).
--   3) Thêm FK public.users.id → auth.users(id) ON DELETE CASCADE, và
--      media_library.created_by ON DELETE SET NULL (xóa user không để lại rác/lỗi).
--   4) Gỡ 2 policy admin "chết" theo email @admin.focusapp.dev (không khớp admin thật).
--   5) DROP bảng sync_log (di sản offline đã gỡ; còn bị hở RLS ở 00001).
--   6) Thêm index cho public.users.status (panel admin lọc theo status).
--
-- Chạy trong: Supabase → SQL Editor, SAU 00006/00008. Idempotent (chạy lại an toàn).
-- ============================================================================

-- ── 1. Chặn tự đổi role/status ──────────────────────────────────────────────
-- Chỉ chặn khi caller là user đã đăng nhập (auth.uid() không null) và KHÔNG phải
-- admin. service_role (Lambda) và SQL Editor (auth.uid() null) vẫn đổi được;
-- admin đổi được (approveUser/updateUserRole) vì is_admin() = true.
CREATE OR REPLACE FUNCTION public.guard_user_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role
    OR NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Không được phép tự thay đổi role/status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_guard ON public.users;
CREATE TRIGGER trg_users_guard
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_self_update();

-- ── 2. Siết INSERT worklogs/stats (service_role bypass RLS nên không cần policy) ─
DROP POLICY IF EXISTS worklogs_service_insert ON public.daily_worklogs;
DROP POLICY IF EXISTS stats_service_insert    ON public.daily_stats;

-- ── 3. Khóa ngoại referential integrity ─────────────────────────────────────
-- public.users.id phải trỏ tới auth.users(id) và cascade khi xóa auth user.
--
-- TRƯỚC KHI THÊM FK: dọn các dòng public.users "mồ côi" — tức đã bị xóa khỏi
-- auth.users nên KHÔNG đăng nhập được nữa (profile chết). Bắt buộc phải xóa,
-- nếu không FK sẽ lỗi 23503. Việc xóa này CASCADE xóa tasks/focus_sessions của
-- các profile đó (dữ liệu vốn không còn ai truy cập được).
-- 👉 Muốn XEM TRƯỚC cái gì sẽ bị xóa, chạy riêng câu này trước:
--    SELECT id, email, status FROM public.users u
--    WHERE NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id = u.id);
DELETE FROM public.users u
WHERE NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id = u.id);

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_id_fkey;
ALTER TABLE public.users
  ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- media_library.created_by: giữ media lại khi xóa admin đã tạo (set null thay vì chặn xóa).
ALTER TABLE public.media_library
  DROP CONSTRAINT IF EXISTS media_library_created_by_fkey;
ALTER TABLE public.media_library
  ADD CONSTRAINT media_library_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- ── 4. Gỡ policy admin "chết" (@admin.focusapp.dev không khớp admin thật) ────
-- Ghi media do policy "Admins manage media" (is_admin/role) ở 00005/rls_policies lo.
DROP POLICY IF EXISTS media_write_admin  ON public.media_library;
DROP POLICY IF EXISTS media_update_admin ON public.media_library;

-- ── 5. DROP bảng chết sync_log (offline đã gỡ) ──────────────────────────────
DROP TABLE IF EXISTS public.sync_log CASCADE;

-- ── 6. Index cho lọc theo status ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);

-- ── 7. Kiểm tra nhanh ───────────────────────────────────────────────────────
-- Thử (bằng tài khoản THƯỜNG, không phải admin) chạy qua PostgREST:
--   PATCH /rest/v1/users?id=eq.<self> {"role":"admin"}  → phải bị lỗi.
-- Admin approve user vẫn hoạt động bình thường.
-- ============================================================================
