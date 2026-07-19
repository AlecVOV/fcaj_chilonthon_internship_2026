-- ============================================================================
-- 00017_feedback.sql
-- Bảng Feedback: user gửi phản hồi về app ngay trong account của họ (trang
-- Profile), Admin đọc qua CMS (/admin/feedback).
--
-- RLS: user chỉ thấy/insert được feedback CỦA CHÍNH MÌNH; admin đọc + sửa
-- (đổi status) được TẤT CẢ. Không cho user sửa/xóa sau khi đã gửi (tránh
-- chỉnh sửa lại review đã gửi cho admin).
--
-- Chạy trong: Supabase → SQL Editor, SAU 00016. Idempotent (chạy lại an toàn).
-- ============================================================================

-- ── 1. Bảng ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feedback (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    message     TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'resolved')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_user ON public.feedback(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.feedback(status, created_at DESC);

-- Tự cập nhật updated_at khi admin đổi status (dùng lại hàm chung từ 00001).
DROP TRIGGER IF EXISTS set_updated_at_feedback ON public.feedback;
CREATE TRIGGER set_updated_at_feedback
    BEFORE UPDATE ON public.feedback
    FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

-- ── 2. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Insert: user chỉ gửi được feedback đứng tên chính mình.
DROP POLICY IF EXISTS feedback_insert_own ON public.feedback;
CREATE POLICY feedback_insert_own ON public.feedback
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Select: user thấy feedback của mình; admin thấy tất cả (is_admin() đọc
-- public.users.role, xem 00001/00009).
DROP POLICY IF EXISTS feedback_select_own_or_admin ON public.feedback;
CREATE POLICY feedback_select_own_or_admin ON public.feedback
    FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

-- Update: chỉ admin (đổi status new -> read/resolved trong CMS). User KHÔNG
-- sửa được nội dung feedback đã gửi.
DROP POLICY IF EXISTS feedback_update_admin ON public.feedback;
CREATE POLICY feedback_update_admin ON public.feedback
    FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Delete: chỉ admin (dọn dẹp CMS nếu cần).
DROP POLICY IF EXISTS feedback_delete_admin ON public.feedback;
CREATE POLICY feedback_delete_admin ON public.feedback
    FOR DELETE USING (public.is_admin());

-- ── 3. Kiểm tra nhanh ───────────────────────────────────────────────────────
-- Bằng tài khoản THƯỜNG:
--   INSERT INTO feedback(user_id, message) VALUES (auth.uid(), 'test');  -> OK
--   SELECT * FROM feedback;                        -> chỉ thấy dòng của mình
--   UPDATE feedback SET status='read' WHERE ...;    -> phải bị RLS chặn
-- Bằng ADMIN: SELECT thấy tất cả, UPDATE status hoạt động bình thường.
-- ============================================================================
