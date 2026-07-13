-- ============================================================================
-- 00015_titan_embeddings.sql
-- (tên file giữ nguyên từ lúc soạn ban đầu — nội dung KHÔNG gắn với model cụ thể nào,
-- chỉ đổi dimension của cột nên vẫn đúng dù đổi model)
--
-- Đổi chiều embedding của media_library từ 384 (all-MiniLM-L6-v2, chưa từng deploy)
-- sang 1024 (Bedrock **Cohere Embed Multilingual v3**, cohere.embed-multilingual-v3 —
-- ban đầu định dùng Titan Embed v2 nhưng Titan KHÔNG có ở ap-southeast-1, đã verify
-- thật; Cohere Multilingual v3 thì có sẵn tại đây, cùng 1024 chiều, không cần cross-
-- region/inference profile — xem aws/lambdas/admin-vectorizer/README.md mục "Vì sao
-- Cohere") để tránh đóng gói model ML vào Lambda (admin-vectorizer/rag-recommender chỉ
-- cần gọi Bedrock API, không cần Lambda Layer/container) — xem docs/ai-features-roadmap.md.
--
-- An toàn để chạy: chưa có Lambda nào từng ghi embedding_vector thật (cả 2 lambda
-- này trước giờ chỉ có README) nên mọi giá trị hiện tại đều NULL — không có dữ
-- liệu 384-dim cần chuyển đổi/mất.
--
-- Chạy trong: Supabase → SQL Editor, SAU 00014. Idempotent (chạy lại an toàn).
-- ============================================================================

-- ── 1. Xóa sạch embedding cũ (phòng trường hợp có giá trị test thủ công) ──────
UPDATE public.media_library SET embedding_vector = NULL WHERE embedding_vector IS NOT NULL;

-- ── 2. Đổi kiểu cột 384 -> 1024 chiều ─────────────────────────────────────────
ALTER TABLE public.media_library
    ALTER COLUMN embedding_vector TYPE VECTOR(1024);

-- ── 3. Rebuild ivfflat index (index cũ gắn với dimension cũ) ──────────────────
DROP INDEX IF EXISTS idx_media_embedding;
CREATE INDEX idx_media_embedding ON public.media_library
    USING ivfflat (embedding_vector vector_cosine_ops)
    WITH (lists = 100);

-- ── 4. search_similar_content(): đổi tham số query_embedding sang VECTOR(1024) ─
-- CREATE OR REPLACE không đổi được kiểu tham số của hàm đã tồn tại -> phải DROP
-- chữ ký cũ (VECTOR(384)) trước.
DROP FUNCTION IF EXISTS public.search_similar_content(VECTOR(384), REAL, INTEGER, TEXT);

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
    SELECT
        ml.id,
        ml.title,
        ml.content_text,
        ml.content_url,
        ml.type,
        ml.source,
        1 - (ml.embedding_vector <=> query_embedding) AS similarity
    FROM public.media_library ml
    WHERE ml.is_active = TRUE
      AND ml.embedding_vector IS NOT NULL
      AND (filter_type IS NULL OR ml.type = filter_type)
      AND 1 - (ml.embedding_vector <=> query_embedding) > match_threshold
    ORDER BY ml.embedding_vector <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- ── 5. Kiểm tra nhanh ──────────────────────────────────────────────────────────
-- SELECT atttypmod FROM pg_attribute
--   WHERE attrelid = 'public.media_library'::regclass AND attname = 'embedding_vector';
--   -> phải ra dimension 1024 (kiểm tra qua format_type hoặc vector_dims() sau khi có data thật)
-- SELECT proname, pg_get_function_arguments(oid) FROM pg_proc WHERE proname = 'search_similar_content';
--   -> query_embedding phải là vector(1024)
--
-- Sau khi chạy migration này: admin-vectorizer PHẢI dùng model embed ra đúng 1024 chiều
-- (mặc định cohere.embed-multilingual-v3 — xem aws/lambdas/admin-vectorizer/lambda_function.py)
-- — KHÔNG dùng lại all-MiniLM-L6-v2 (384 chiều) nữa, lệch chiều sẽ khiến
-- search_similar_content() lỗi ngay lúc gọi.
-- ============================================================================
