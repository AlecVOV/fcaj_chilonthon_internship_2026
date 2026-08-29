-- ============================================================================
-- 00020_user_notes.sql
-- Bảng User Notes: 1 khung ghi chú cá nhân mỗi user (nội dung Markdown thô,
-- render Markdown ở client sau khi bấm Save — xem pages/notes.vue,
-- utils/markdown.ts::renderMarkdown, tái dùng đúng lib marked+dompurify đã có
-- sẵn cho AgentChat, không cần thêm dependency mới).
--
-- 1 dòng / user (UNIQUE user_id) — upsert theo user_id thay vì nhiều note rời.
--
-- RLS: chỉ chủ sở hữu đọc/ghi (không có khái niệm admin xem note cá nhân).
--
-- Chạy trong: Supabase → SQL Editor, SAU 00019. Idempotent (chạy lại an toàn).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_notes (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    content     TEXT NOT NULL DEFAULT '',
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at_user_notes ON public.user_notes;
CREATE TRIGGER set_updated_at_user_notes
    BEFORE UPDATE ON public.user_notes
    FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_notes_owner_access ON public.user_notes;
CREATE POLICY user_notes_owner_access ON public.user_notes
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
