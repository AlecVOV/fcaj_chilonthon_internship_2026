-- ============================================================================
-- 00013_ambient_sounds.sql
-- Bảng nhạc nền (Ambient Sound) do Admin quản lý (CRUD), User đọc để hiển thị
-- ngoài trang Focus. File MP3 vật lý nằm trên AWS S3 (bucket ambient audio);
-- bảng này chỉ lưu METADATA: tên + link S3 công khai.
--
-- Luồng:
--   Admin upload MP3 → S3 (qua Lambda presigned) → copy public URL
--        → thêm 1 dòng vào bảng này (name + url)
--   User mở trang Focus → đọc các dòng is_active = true → chọn phát.
--
-- RLS: MỌI user đã đăng nhập ĐỌC được (để hiển thị); chỉ ADMIN ghi (is_admin()).
--
-- Chạy trong: Supabase → SQL Editor, SAU 00012. Idempotent (chạy lại an toàn).
-- ============================================================================

-- ── 1. Bảng ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ambient_sounds (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,                 -- Tên bài nhạc hiển thị cho user
    url         TEXT NOT NULL,                 -- S3 public URL của file MP3
    is_active   BOOLEAN NOT NULL DEFAULT TRUE, -- false = ẩn khỏi trang Focus (không xóa)
    sort_order  INTEGER NOT NULL DEFAULT 0,    -- thứ tự hiển thị (nhỏ → trước)
    created_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ambient_active ON public.ambient_sounds(is_active, sort_order);

-- Tự cập nhật updated_at (dùng lại hàm chung từ 00001).
DROP TRIGGER IF EXISTS set_updated_at_ambient ON public.ambient_sounds;
CREATE TRIGGER set_updated_at_ambient
    BEFORE UPDATE ON public.ambient_sounds
    FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

-- ── 2. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.ambient_sounds ENABLE ROW LEVEL SECURITY;

-- Đọc: mọi user đã đăng nhập (để trang Focus hiển thị danh sách).
DROP POLICY IF EXISTS ambient_read_all ON public.ambient_sounds;
CREATE POLICY ambient_read_all ON public.ambient_sounds
    FOR SELECT USING (auth.role() = 'authenticated');

-- Ghi (INSERT/UPDATE/DELETE): chỉ admin. is_admin() đọc public.users.role.
DROP POLICY IF EXISTS ambient_write_admin ON public.ambient_sounds;
CREATE POLICY ambient_write_admin ON public.ambient_sounds
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── 3. Kiểm tra nhanh ───────────────────────────────────────────────────────
-- Bằng tài khoản THƯỜNG:
--   SELECT * FROM ambient_sounds;                       -> đọc được
--   INSERT INTO ambient_sounds(name,url) VALUES('x','y'); -> phải bị RLS chặn
-- Bằng ADMIN: INSERT/UPDATE/DELETE hoạt động bình thường.
-- ============================================================================
