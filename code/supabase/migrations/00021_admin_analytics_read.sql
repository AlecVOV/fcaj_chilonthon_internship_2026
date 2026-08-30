-- ============================================================================
-- 00021_admin_analytics_read.sql
-- US-ADM-01/04 (admin analytics — tổng giờ focus toàn hệ thống, user hoạt động
-- nhiều nhất, drill-down từng user): trước giờ focus_sessions/tasks chỉ có policy
-- "owner access" (auth.uid() = user_id), nên admin KHÔNG đọc được session/task của
-- người khác — cần thêm 1 policy SELECT riêng cho is_admin(), y hệt pattern đã
-- dùng ở announcements_select_all/media_read_all. RLS cho phép NHIỀU permissive
-- policy cùng lệnh (OR lại với nhau) nên thêm policy này không ảnh hưởng gì tới
-- policy "owner access" hiện có (users thường vẫn chỉ thấy dữ liệu của mình).
--
-- Chạy trong: Supabase → SQL Editor, SAU 00020. Idempotent (chạy lại an toàn).
-- ============================================================================

DROP POLICY IF EXISTS focus_sessions_admin_read ON public.focus_sessions;
CREATE POLICY focus_sessions_admin_read ON public.focus_sessions
    FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS tasks_admin_read ON public.tasks;
CREATE POLICY tasks_admin_read ON public.tasks
    FOR SELECT USING (public.is_admin());

-- Kiểm tra nhanh sau khi chạy: đăng nhập bằng tài khoản admin, gọi
--   GET /rest/v1/focus_sessions?select=id,user_id&limit=5
-- phải trả về session của NHIỀU user khác nhau (không chỉ của admin), còn tài
-- khoản user thường gọi cùng endpoint vẫn chỉ thấy session của chính mình.
-- ============================================================================
