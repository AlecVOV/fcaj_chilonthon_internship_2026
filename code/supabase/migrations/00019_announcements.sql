-- ============================================================================
-- 00019_announcements.sql
-- Bảng Announcements: admin đăng thông báo tính năng mới / thay đổi, mọi user
-- đã đăng nhập đều đọc được. Trạng thái "đã xem" lưu CLIENT-SIDE (localStorage
-- focus_seen_announcements — xem composables/useAnnouncements.ts), không cần
-- bảng read-state riêng vì không cần đồng bộ đa thiết bị cho tính năng này.
--
-- RLS: mọi user đã đăng nhập SELECT được tất cả; chỉ admin INSERT/UPDATE/DELETE.
--
-- Chạy trong: Supabase → SQL Editor, SAU 00018. Idempotent (chạy lại an toàn).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.announcements (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title       TEXT NOT NULL,
    message     TEXT NOT NULL,
    created_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_created ON public.announcements(created_at DESC);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Select: bất kỳ user đã đăng nhập nào (không giới hạn theo user_id — thông báo công khai).
DROP POLICY IF EXISTS announcements_select_all ON public.announcements;
CREATE POLICY announcements_select_all ON public.announcements
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Insert/Update/Delete: chỉ admin.
DROP POLICY IF EXISTS announcements_write_admin ON public.announcements;
CREATE POLICY announcements_write_admin ON public.announcements
    FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS announcements_update_admin ON public.announcements;
CREATE POLICY announcements_update_admin ON public.announcements
    FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS announcements_delete_admin ON public.announcements;
CREATE POLICY announcements_delete_admin ON public.announcements
    FOR DELETE USING (public.is_admin());
