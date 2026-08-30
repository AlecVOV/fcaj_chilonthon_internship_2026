-- ============================================================================
-- 00022_media_chunks.sql
-- RAG chunking (ai-features-roadmap.md mục 5): admin-vectorizer trước giờ CẮT CỤT
-- content_text ở MAX_INPUT_CHARS=2000 ký tự trước khi embed (giới hạn cứng của
-- Bedrock Cohere embed, xem aws/lambdas/admin-vectorizer/lambda_function.py) — nội
-- dung dài (vd bài giảng/transcript nhiều đoạn) chỉ có 2000 ký tự ĐẦU được đưa vào
-- tìm kiếm, phần còn lại vô hình với RAG dù đã lưu đủ trong content_text.
--
-- Giải pháp: bảng media_chunks mới — mỗi media_library item dài được chia thành
-- NHIỀU chunk (mỗi chunk tự embed riêng, vẫn nằm dưới giới hạn Cohere), thay vì 1
-- embedding_vector duy nhất trên media_library. search_similar_content() đổi sang
-- tìm trên media_chunks rồi gộp lại theo media_id (lấy chunk khớp nhất/item) — chữ
-- ký hàm GIỮ NGUYÊN (không đổi tham số) nên rag-recommender KHÔNG cần sửa gì.
--
-- media_library.embedding_vector giữ nguyên cột (không xóa, tránh migration phá
-- hoại) nhưng từ nay KHÔNG còn được admin-vectorizer ghi/dùng nữa — coi như đã
-- deprecated, chunk-level embedding trong media_chunks là nguồn thật duy nhất.
--
-- Chạy trong: Supabase → SQL Editor, SAU 00021. Idempotent (chạy lại an toàn).
-- ============================================================================

-- ── 1. Bảng chunk ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.media_chunks (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    media_id         UUID NOT NULL REFERENCES public.media_library(id) ON DELETE CASCADE,
    chunk_index      INTEGER NOT NULL,
    content_text     TEXT NOT NULL,
    embedding_vector VECTOR(1024),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(media_id, chunk_index)   -- admin-vectorizer re-embed = upsert theo (media_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_media_chunks_media_id ON public.media_chunks(media_id);

CREATE INDEX IF NOT EXISTS idx_media_chunks_embedding ON public.media_chunks
    USING ivfflat (embedding_vector vector_cosine_ops)
    WITH (lists = 100);

-- ── 2. RLS — cùng pattern media_read_all / is_admin() đã dùng ở 00019 ─────────
ALTER TABLE public.media_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS media_chunks_read_all ON public.media_chunks;
CREATE POLICY media_chunks_read_all ON public.media_chunks
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS media_chunks_write_admin ON public.media_chunks;
CREATE POLICY media_chunks_write_admin ON public.media_chunks
    FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS media_chunks_update_admin ON public.media_chunks;
CREATE POLICY media_chunks_update_admin ON public.media_chunks
    FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS media_chunks_delete_admin ON public.media_chunks;
CREATE POLICY media_chunks_delete_admin ON public.media_chunks
    FOR DELETE USING (public.is_admin());

-- ── 3. search_similar_content(): tìm trên media_chunks, gộp theo media_id ─────
-- Chữ ký giống hệt 00015 (query_embedding VECTOR(1024), match_threshold REAL
-- DEFAULT 0.3, match_count INTEGER DEFAULT 5, filter_type TEXT DEFAULT NULL) nên
-- dùng CREATE OR REPLACE trực tiếp (không cần DROP FUNCTION trước như lúc đổi
-- 384->1024 chiều, vì tham số không đổi kiểu lần này).
--
-- DISTINCT ON (ml.id) ... ORDER BY ml.id, mc.embedding_vector <=> query_embedding
-- lấy CHUNK GẦN NHẤT của mỗi media item (tránh 1 item dài chiếm nhiều chỗ trong
-- kết quả chỉ vì có nhiều chunk) -- sau đó lọc threshold + sắp lại theo similarity
-- rồi mới LIMIT, giữ đúng hành vi "mỗi item xuất hiện tối đa 1 lần" như bản cũ.
CREATE OR REPLACE FUNCTION public.search_similar_content(
    query_embedding VECTOR(1024),
    match_threshold REAL DEFAULT 0.3,
    match_count INTEGER DEFAULT 5,
    filter_type TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    content_text TEXT,
    content_url TEXT,
    type TEXT,
    source TEXT,
    similarity REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT ranked.id, ranked.title, ranked.content_text, ranked.content_url, ranked.type, ranked.source, ranked.similarity
    FROM (
        SELECT DISTINCT ON (ml.id)
            ml.id,
            ml.title,
            mc.content_text,
            ml.content_url,
            ml.type,
            ml.source,
            1 - (mc.embedding_vector <=> query_embedding) AS similarity
        FROM public.media_chunks mc
        JOIN public.media_library ml ON ml.id = mc.media_id
        WHERE ml.is_active = TRUE
          AND mc.embedding_vector IS NOT NULL
          AND (filter_type IS NULL OR ml.type = filter_type)
        ORDER BY ml.id, mc.embedding_vector <=> query_embedding
    ) ranked
    WHERE ranked.similarity > match_threshold
    ORDER BY ranked.similarity DESC
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- ── 4. Kiểm tra nhanh ──────────────────────────────────────────────────────────
-- SELECT proname, pg_get_function_arguments(oid) FROM pg_proc WHERE proname = 'search_similar_content';
--   -> vẫn query_embedding vector(1024), match_threshold real, match_count integer, filter_type text
-- Sau khi admin-vectorizer chạy /embed-all lần đầu SAU migration này:
--   SELECT media_id, count(*) FROM public.media_chunks GROUP BY media_id;
--   -> item content_text dài (>2000 ký tự) phải có > 1 chunk, item ngắn có đúng 1 chunk.
-- ============================================================================
