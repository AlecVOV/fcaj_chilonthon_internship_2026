-- ============================================================================
-- 00010_task_completed_at.sql
-- Thêm cột completed_at BẤT BIẾN cho tasks → map/đánh giá theo ngày ỔN ĐỊNH.
--
-- Vấn đề: worklog/thống kê/review đang gắn task theo `updated_at`, mà cột này đổi
-- MỖI LẦN sửa row (kể cả sửa review sau này) → task "nhảy" sang ngày mới nhất,
-- làm lệch đánh giá theo ngày (và sẽ ảnh hưởng AI phân tích theo ngày về sau).
--
-- Giải pháp: `completed_at` đặt MỘT LẦN khi status → 'completed' (trigger giữ),
-- KHÔNG đổi khi sửa review; null khi bỏ hoàn thành. Mọi writer (frontend / AI
-- lambda / SQL) đều đúng nhờ trigger.
--
-- Chạy trong: Supabase → SQL Editor. Idempotent (chạy lại an toàn).
-- ============================================================================

-- 1. Cột completed_at
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 2. Backfill: task đã completed → lấy updated_at làm mốc hoàn thành gần đúng
UPDATE public.tasks
SET completed_at = updated_at
WHERE status = 'completed' AND completed_at IS NULL;

-- 3. Trigger tự quản completed_at theo status
CREATE OR REPLACE FUNCTION public.set_task_completed_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    -- Chỉ đặt khi VỪA chuyển sang completed (hoặc INSERT completed); nếu đã
    -- completed từ trước thì GIỮ NGUYÊN → sửa review KHÔNG làm đổi ngày.
    IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed' THEN
      NEW.completed_at := COALESCE(NEW.completed_at, now());
    END IF;
  ELSE
    NEW.completed_at := NULL;  -- bỏ hoàn thành → xóa mốc
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_completed_at ON public.tasks;
CREATE TRIGGER trg_task_completed_at
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_task_completed_at();

-- 4. Index cho truy vấn theo ngày hoàn thành (dashboard / worklog / AI)
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON public.tasks(user_id, completed_at);

-- 5. Kiểm tra: sửa review của task completed KHÔNG được làm đổi completed_at
--    (chỉ updated_at đổi). completed_at chỉ đổi khi complete/uncomplete.
-- ============================================================================
