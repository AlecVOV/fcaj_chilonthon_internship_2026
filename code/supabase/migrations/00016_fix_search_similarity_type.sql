-- ============================================================================
-- 00016_fix_search_similarity_type.sql
-- Fix bug thật trong search_similar_content() — có sẵn từ 00001_initial_schema.sql
-- (mang nguyên sang khi đổi chiều ở 00015), CHƯA bị lộ ra vì đây là lần đầu tiên
-- có Lambda thật gọi RPC này (rag-recommender, 2026-07-13).
--
-- Lỗi thật (đã verify qua curl PostgREST trực tiếp):
--   {"code":"42804","message":"structure of query does not match function result type",
--    "details":"Returned type double precision does not match expected type real in
--    column 7."}
--
-- Nguyên nhân: cột `similarity` khai `REAL` (float4) trong RETURNS TABLE, nhưng biểu
-- thức `1 - (ml.embedding_vector <=> query_embedding)` trả về `DOUBLE PRECISION`
-- (float8) — toán tử `<=>` của pgvector luôn trả double precision. Postgres KHÔNG tự
-- ép kiểu ngầm double precision -> real trong ngữ cảnh RETURNS TABLE, nên hàm lỗi
-- ngay khi có row trả về (nếu RLS lọc về 0 dòng thì không lộ bug — đây là lý do
-- report/dashboard cũ không phát hiện ra).
--
-- Fix: ép kiểu tường minh ::REAL ngay trong SELECT — KHÔNG đổi signature hàm (tham số
-- + RETURNS TABLE giữ nguyên) nên chỉ cần CREATE OR REPLACE, không cần DROP FUNCTION.
--
-- Chạy trong: Supabase → SQL Editor, SAU 00015. Idempotent (chạy lại an toàn).
-- ============================================================================

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
        (1 - (ml.embedding_vector <=> query_embedding))::REAL AS similarity
    FROM public.media_library ml
    WHERE ml.is_active = TRUE
      AND ml.embedding_vector IS NOT NULL
      AND (filter_type IS NULL OR ml.type = filter_type)
      AND 1 - (ml.embedding_vector <=> query_embedding) > match_threshold
    ORDER BY ml.embedding_vector <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- ── Kiểm tra nhanh (chạy sau khi apply, cần 1 media item đã có embedding_vector) ──
-- SELECT * FROM public.search_similar_content(
--   (SELECT embedding_vector FROM public.media_library WHERE embedding_vector IS NOT NULL LIMIT 1),
--   0.0, 5, NULL
-- );
-- -> phải trả về ít nhất 1 dòng (chính item đó, similarity ~1.0), KHÔNG còn lỗi 42804.
-- ============================================================================
