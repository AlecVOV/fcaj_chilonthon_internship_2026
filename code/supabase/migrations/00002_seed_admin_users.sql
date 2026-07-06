-- ============================================================================
-- Seed Admin Users
-- Insert the 4 admin accounts into public.users with role='admin'.
-- Run AFTER 00001_initial_schema.sql and rls_policies.sql.
-- ============================================================================

INSERT INTO public.users (id, email, display_name, role)
VALUES
  ('199a61dd-626a-400c-a036-db146b6fab50', 'lehoangtrietthong@gmail.com',          'Triet Thong',         'admin'),
  ('0a5961b7-f70d-4e62-80d0-a14069332360', 'lehoangtrietthong2102004@gmail.com',    'Triet Thong (2)',     'admin'),
  ('5407c1c3-6caa-4b84-a943-ae4df0c2502a', 'lhtthong.forwork@outlook.com',          'Triet Thong (Work)',  'admin'),
  ('4d9a94e8-8daa-4d2e-812a-dff9f72f0863', 'lhtthong.forwork@gmail.com',            'Triet Thong (Gmail)', 'admin')
ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      display_name = EXCLUDED.display_name,
      role = EXCLUDED.role;
