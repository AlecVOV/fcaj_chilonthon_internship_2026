-- ============================================================================
-- Seed Admin Users into public.users ONLY (auth.users via Supabase Dashboard)
-- ============================================================================
--
-- STEP 1 (SQL): Run this file in Supabase SQL Editor — inserts into public.users.
--
-- STEP 2 (UI):  Go to Supabase Dashboard → Authentication → Users → Add User.
--               Create each user below with password "admin123".
--               Check "Auto Confirm User" so no email verification needed.
--
-- The trigger (00003) will skip duplicates thanks to ON CONFLICT DO NOTHING.
-- ============================================================================

INSERT INTO public.users (id, email, display_name, role)
VALUES
  ('199a61dd-626a-400c-a036-db146b6fab50', 'lehoangtrietthong@gmail.com',          'Le Hoang Triet Thong',  'admin'),
  ('0a5961b7-f70d-4e62-80d0-a14069332360', 'lehoangtrietthong2102004@gmail.com',    'Le Hoang Triet Thong',  'admin'),
  ('5407c1c3-6caa-4b84-a943-ae4df0c2502a', 'lhtthong.forwork@outlook.com',          'Chi Lon Thon',          'admin'),
  ('4d9a94e8-8daa-4d2e-812a-dff9f72f0863', 'lhtthong.forwork@gmail.com',            'Chi Thon',              'admin')
ON CONFLICT (id) DO UPDATE
  SET role = 'admin';
