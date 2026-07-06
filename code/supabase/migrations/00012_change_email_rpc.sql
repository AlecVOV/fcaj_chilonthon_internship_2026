-- ============================================================================
-- 00012_change_email_rpc.sql
-- RPC đổi email NGAY LẬP TỨC (không cần confirm qua link).
--
-- Vì sao: một số project Supabase VẪN bắt xác nhận email-change dù đã tắt
-- "Confirm email" + "Secure email change" → gọi supabase.auth.updateUser({email})
-- từ client bị kẹt ở pending. RPC này tự động hoá đúng cái SQL đổi thẳng auth.users
-- (vốn đã work), nhưng an toàn: chỉ đổi email của CHÍNH MÌNH (auth.uid()), chặn
-- email trùng, và chỉ 'authenticated' mới gọi được.
--
-- Frontend gọi: supabase.rpc('change_my_email', { new_email }).
-- Chạy trong: Supabase → SQL Editor. Idempotent.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.change_my_email(new_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_new text := lower(trim(new_email));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Chưa đăng nhập';
  END IF;
  IF v_new = '' OR v_new !~ '^.+@.+\..+$' THEN
    RAISE EXCEPTION 'Email không hợp lệ';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_new AND id <> v_uid) THEN
    RAISE EXCEPTION 'Email này đã có người dùng';
  END IF;

  -- Đổi thẳng danh tính đăng nhập + xác nhận luôn + dọn state đổi-email pending.
  UPDATE auth.users
  SET email = v_new,
      email_change = '', email_change_token_new = '', email_change_token_current = '',
      email_change_confirm_status = 0,
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now()
  WHERE id = v_uid;

  -- Đồng bộ identity của provider email (email column là generated từ identity_data).
  UPDATE auth.identities
  SET identity_data = jsonb_set(identity_data, '{email}', to_jsonb(v_new)),
      updated_at = now()
  WHERE user_id = v_uid AND provider = 'email';

  -- Mirror public.users (trigger 00011 cũng làm; set thêm cho chắc).
  UPDATE public.users SET email = v_new WHERE id = v_uid;
END;
$$;

-- Chỉ user đã đăng nhập mới gọi được.
REVOKE ALL ON FUNCTION public.change_my_email(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.change_my_email(text) TO authenticated;
-- ============================================================================
