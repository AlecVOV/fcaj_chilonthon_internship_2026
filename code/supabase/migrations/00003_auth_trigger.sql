-- ============================================================================
-- Supabase Auth Trigger — sync auth.users → public.users
-- Run this in Supabase SQL Editor after the schema migration.
--
-- On every new sign-up (INSERT into auth.users), this trigger automatically
-- inserts a corresponding row into public.users.
-- Email addresses matching the admin list get role='admin' automatically.
-- ============================================================================

-- 1. Create the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)),
    CASE
      WHEN NEW.email = ANY(ARRAY[
        'lehoangtrietthong@gmail.com',
        'lehoangtrietthong2102004@gmail.com',
        'lhtthong.forwork@outlook.com',
        'lhtthong.forwork@gmail.com'
      ]) THEN 'admin'
      ELSE 'user'
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 2. Attach the trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
