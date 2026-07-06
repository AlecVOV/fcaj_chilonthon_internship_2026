-- ============================================================================
-- 00005_seed_demo_accounts.sql
-- Seed demo admin & user accounts directly into Supabase Auth + public.users.
-- These accounts have FULL access from the start and BYPASS the request/approval flow.
--
-- Credentials:
--   Admin: admin@focusmode.app   / admin123   (role='admin', full access)
--   User:  user@focusmode.app    / user123    (role='user')
--
-- Run in: Supabase SQL Editor (requires pgcrypto extension for password hashing)
-- ============================================================================

-- 0. Ensure extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. (removed) The legacy public.user_requests table was deleted in 00007.
--    The live approval flow uses public.users.status (see 00006); demo accounts
--    below are pre-approved and bypass approval entirely.
-- ============================================================================

-- ============================================================================
-- 2. Insert demo users into auth.users (Supabase internal auth table)
--    Uses pgcrypto bcrypt for password hashing — compatible with Supabase Auth.
--    email_confirmed_at = NOW() → no email verification required.
--    confirmed_at = NOW()      → account is immediately active.
-- ============================================================================

-- Pre-generate fixed UUIDs so we can reference them in public.users
DO $$
DECLARE
    admin_id    UUID := 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    user_id     UUID := 'f47ac10b-58cc-4372-a567-0e02b2c3d480';
BEGIN

    -- 2.1 Admin account
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        last_sign_in_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        created_at,
        updated_at,
        phone,
        phone_confirmed_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        admin_id,
        'authenticated',
        'authenticated',
        'admin@focusmode.app',
        crypt('admin123', gen_salt('bf', 10)),
        NOW(),
        NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"display_name":"Admin","role":"admin"}'::jsonb,
        FALSE,
        NOW(),
        NOW(),
        NULL,
        NULL,
        '',
        '',
        '',
        ''
    )
    ON CONFLICT (id) DO UPDATE
        SET encrypted_password = EXCLUDED.encrypted_password,
            email_confirmed_at = NOW(),
            raw_user_meta_data = EXCLUDED.raw_user_meta_data,
            updated_at = NOW();

    -- 2.2 Regular user account
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        last_sign_in_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        created_at,
        updated_at,
        phone,
        phone_confirmed_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        user_id,
        'authenticated',
        'authenticated',
        'user@focusmode.app',
        crypt('user123', gen_salt('bf', 10)),
        NOW(),
        NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"display_name":"Demo User","role":"user"}'::jsonb,
        FALSE,
        NOW(),
        NOW(),
        NULL,
        NULL,
        '',
        '',
        '',
        ''
    )
    ON CONFLICT (id) DO UPDATE
        SET encrypted_password = EXCLUDED.encrypted_password,
            email_confirmed_at = NOW(),
            raw_user_meta_data = EXCLUDED.raw_user_meta_data,
            updated_at = NOW();

    -- ========================================================================
    -- 3. Insert into public.users (application-level users table)
    -- ========================================================================

    INSERT INTO public.users (id, email, display_name, role)
    VALUES
        (admin_id, 'admin@focusmode.app', 'Admin', 'admin'),
        (user_id,  'user@focusmode.app',  'Demo User', 'user')
    ON CONFLICT (id) DO UPDATE
        SET email        = EXCLUDED.email,
            display_name = EXCLUDED.display_name,
            role         = EXCLUDED.role;

END $$;

-- ============================================================================
-- 4. Update the auth trigger to also recognize demo accounts as admin
--    (adds admin@focusmode.app / user@focusmode.app to the auto-admin list)
-- ============================================================================

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
        -- Original admin emails
        'lehoangtrietthong@gmail.com',
        'lehoangtrietthong2102004@gmail.com',
        'lhtthong.forwork@outlook.com',
        'lhtthong.forwork@gmail.com',
        -- Demo accounts (bypass approval)
        'admin@focusmode.app'
      ]) THEN 'admin'
      WHEN NEW.email = ANY(ARRAY[
        'user@focusmode.app'
      ]) THEN 'user'
      ELSE 'user'
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Re-attach trigger (safe to re-run)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 5. Ensure admin RLS policies grant FULL access to the admin account
--    Admin can read/write ALL rows in ALL tables, bypassing user-scoped RLS.
-- ============================================================================

-- 5.1 Users table — admin can read & manage all users
DROP POLICY IF EXISTS "Admins read all users" ON public.users;
CREATE POLICY "Admins read all users" ON public.users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins manage all users" ON public.users;
CREATE POLICY "Admins manage all users" ON public.users
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- 5.2 Tasks — admin can read/manage all tasks
DROP POLICY IF EXISTS "Admins read all tasks" ON public.tasks;
CREATE POLICY "Admins read all tasks" ON public.tasks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins manage all tasks" ON public.tasks;
CREATE POLICY "Admins manage all tasks" ON public.tasks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- 5.3 Focus Sessions — admin can read/manage all
DROP POLICY IF EXISTS "Admins read all sessions" ON public.focus_sessions;
CREATE POLICY "Admins read all sessions" ON public.focus_sessions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins manage all sessions" ON public.focus_sessions;
CREATE POLICY "Admins manage all sessions" ON public.focus_sessions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- 5.4 Daily Worklogs — admin read all
DROP POLICY IF EXISTS "Admins read all worklogs" ON public.daily_worklogs;
CREATE POLICY "Admins read all worklogs" ON public.daily_worklogs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- 5.5 Daily Stats — admin read all
DROP POLICY IF EXISTS "Admins read all stats" ON public.daily_stats;
CREATE POLICY "Admins read all stats" ON public.daily_stats
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- 5.6 Media Library — admin full access (already covered, but ensure it exists)
DROP POLICY IF EXISTS "Admins manage media" ON public.media_library;
CREATE POLICY "Admins manage media" ON public.media_library
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- 6. Verification queries (run these after to confirm)
-- ============================================================================

-- Verify auth.users entries:
-- SELECT id, email, email_confirmed_at, raw_user_meta_data
-- FROM auth.users
-- WHERE email IN ('admin@focusmode.app', 'user@focusmode.app');

-- Verify public.users entries:
-- SELECT id, email, display_name, role
-- FROM public.users
-- WHERE email IN ('admin@focusmode.app', 'user@focusmode.app');

-- ============================================================================
-- DONE. Demo accounts are ready to use:
--   Admin: admin@focusmode.app / admin123  (role='admin', bypasses all RLS)
--   User:  user@focusmode.app  / user123   (role='user',  scoped to own data)
-- ============================================================================
