-- ============================================================================
-- 00018_task_sort_order.sql
-- Thêm cột sort_order cho public.tasks để hỗ trợ kéo-thả sắp xếp lại thứ tự
-- task trên trang Tasks (danh sách "Active" gộp pending+in_progress).
--
-- Không cần policy RLS mới — tasks_owner_access (00001) đã là FOR ALL USING
-- (auth.uid() = user_id), tự động phủ luôn cột mới.
--
-- Chạy trong: Supabase → SQL Editor, SAU 00017. Idempotent (chạy lại an toàn).
-- ============================================================================

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_tasks_user_sort ON public.tasks(user_id, sort_order);

-- Backfill: cho task cũ (sort_order mặc định 0) một thứ tự ổn định theo created_at,
-- MỚI NHẤT = sort_order NHỎ NHẤT (0,1,2,...) để khớp đúng thứ tự "mới nhất trước"
-- app đang hiển thị mặc định — tránh xáo trộn danh sách ngay sau khi chạy migration.
WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) - 1 AS rn
    FROM public.tasks
    WHERE sort_order = 0
)
UPDATE public.tasks t
SET sort_order = ranked.rn
FROM ranked
WHERE t.id = ranked.id;
