-- ============================================================================
-- 00014_agent_chat_and_usage.sql
-- (R2) Lưu hội thoại AI: agent_conversations + agent_messages (mỗi user nhiều đoạn chat).
-- (R3) Giới hạn số lượt prompt AI/ngày: agent_daily_usage + RPC bump_agent_usage().
--
-- RLS: user chỉ đọc/ghi dữ liệu của CHÍNH mình. Bảng usage chỉ cho ĐỌC (đếm hiển thị);
-- việc TĂNG đếm đi qua RPC SECURITY DEFINER (agent-bff gọi bằng token user) để atomic
-- + chặn khi vượt hạn.
--
-- Chạy trong: Supabase → SQL Editor, SAU 00013. Idempotent.
-- ============================================================================

-- ── R2: Hội thoại AI ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_conversations (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title       TEXT NOT NULL DEFAULT 'New chat',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_conv_user ON public.agent_conversations(user_id, updated_at DESC);

DROP TRIGGER IF EXISTS set_updated_at_agent_conv ON public.agent_conversations;
CREATE TRIGGER set_updated_at_agent_conv
    BEFORE UPDATE ON public.agent_conversations
    FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

CREATE TABLE IF NOT EXISTS public.agent_messages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.agent_conversations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN ('user', 'agent')),
    content         TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_msg_conv ON public.agent_messages(conversation_id, created_at);

ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_conv_owner ON public.agent_conversations;
CREATE POLICY agent_conv_owner ON public.agent_conversations
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS agent_msg_owner ON public.agent_messages;
CREATE POLICY agent_msg_owner ON public.agent_messages
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── R3: Giới hạn lượt prompt AI / ngày ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_daily_usage (
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    day     DATE NOT NULL DEFAULT CURRENT_DATE,
    count   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day)
);
ALTER TABLE public.agent_daily_usage ENABLE ROW LEVEL SECURITY;

-- Chỉ cho ĐỌC dòng của mình (để hiển thị "đã dùng X/N"). Ghi qua RPC bên dưới.
DROP POLICY IF EXISTS agent_usage_owner_read ON public.agent_daily_usage;
CREATE POLICY agent_usage_owner_read ON public.agent_daily_usage
    FOR SELECT USING (auth.uid() = user_id);

-- Tăng đếm atomic + chặn khi vượt hạn. Trả về:
--   > 0  = số lượt đã dùng SAU khi tăng (được phép)
--   -1   = đã đạt/vượt p_limit (KHÔNG tăng) hoặc chưa đăng nhập
CREATE OR REPLACE FUNCTION public.bump_agent_usage(p_limit INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    uid UUID := auth.uid();
    cur INTEGER;
BEGIN
    IF uid IS NULL THEN
        RETURN -1;
    END IF;
    INSERT INTO public.agent_daily_usage(user_id, day, count)
        VALUES (uid, CURRENT_DATE, 0)
        ON CONFLICT (user_id, day) DO NOTHING;
    SELECT count INTO cur FROM public.agent_daily_usage
        WHERE user_id = uid AND day = CURRENT_DATE FOR UPDATE;
    IF cur >= p_limit THEN
        RETURN -1;
    END IF;
    UPDATE public.agent_daily_usage SET count = count + 1
        WHERE user_id = uid AND day = CURRENT_DATE;
    RETURN cur + 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bump_agent_usage(INTEGER) TO authenticated;

-- ── Kiểm tra nhanh ───────────────────────────────────────────────────────────
-- select public.bump_agent_usage(20);  -- gọi bằng tài khoản đã đăng nhập, trả 1,2,3...; -1 khi >=20
-- ============================================================================
