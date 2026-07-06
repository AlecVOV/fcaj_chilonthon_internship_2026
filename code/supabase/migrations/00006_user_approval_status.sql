-- ============================================================================
-- 00006_user_approval_status.sql
-- Adds a real, Supabase-backed user approval workflow.
--
-- Fixes the previous broken behaviour where approval lived only in browser
-- memory (mock mode) and was never persisted to the database:
--   • Adds public.users.status (pending | approved | rejected)
--   • New sign-ups become 'pending' (admins are auto 'approved')
--   • Admins can read/update every user row (recursion-safe via is_admin())
--   • cloudLogin (front-end) blocks pending/rejected users from signing in
--
-- Run this in the Supabase SQL Editor AFTER 00001 (schema) and 00003/00005.
-- Safe to re-run (idempotent).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Add the status column
-- ----------------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'approved', 'rejected'));

-- Existing rows predate the approval gate → grant them access.
-- (Only affects rows that exist right now; new rows default to 'pending'.)
UPDATE public.users SET status = 'approved' WHERE status = 'pending';

-- Admins are always approved.
UPDATE public.users SET status = 'approved' WHERE role = 'admin';

-- ----------------------------------------------------------------------------
-- 2. Recursion-safe admin check
--    A SECURITY DEFINER function bypasses RLS *inside* the function, so policies
--    on public.users can call it without triggering infinite recursion
--    ("infinite recursion detected in policy for relation users").
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ----------------------------------------------------------------------------
-- 3. Update the new-user trigger to set role + status
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  v_is_admin := NEW.email = ANY(ARRAY[
    'lehoangtrietthong@gmail.com',
    'lehoangtrietthong2102004@gmail.com',
    'lhtthong.forwork@outlook.com',
    'lhtthong.forwork@gmail.com',
    'admin@focusmode.app'
  ]);

  INSERT INTO public.users (id, email, display_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)),
    CASE WHEN v_is_admin THEN 'admin' ELSE 'user' END,
    CASE WHEN v_is_admin THEN 'approved' ELSE 'pending' END
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 4. RLS policies on public.users (recursion-safe)
--    self: read + update own row;  admin: read + manage all rows.
-- ----------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own profile"   ON public.users;
DROP POLICY IF EXISTS "Users update own profile" ON public.users;
DROP POLICY IF EXISTS "Admins read all users"    ON public.users;
DROP POLICY IF EXISTS "Admins manage all users"  ON public.users;
DROP POLICY IF EXISTS "users_self_access"        ON public.users;

CREATE POLICY "Users read own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins read all users" ON public.users
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins manage all users" ON public.users
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 5. Verify
-- ----------------------------------------------------------------------------
-- SELECT id, email, role, status FROM public.users ORDER BY created_at;
-- ============================================================================
