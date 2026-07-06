-- ============================================================================
-- NUKE SCRIPT — Drop everything created by 00001_initial_schema.sql
-- Run this before re-running the migration from scratch.
-- WARNING: Destroys all data. No undo.
-- ============================================================================

-- 1. Drop all RLS policies (disable RLS first to avoid dependency errors)
ALTER TABLE IF EXISTS public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.focus_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.daily_worklogs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.daily_stats DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.media_library DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sync_log DISABLE ROW LEVEL SECURITY;

-- 2. Drop all triggers
DROP TRIGGER IF EXISTS set_updated_at_tasks ON public.tasks;
DROP TRIGGER IF EXISTS set_updated_at_sessions ON public.focus_sessions;
DROP TRIGGER IF EXISTS set_updated_at_worklogs ON public.daily_worklogs;
DROP TRIGGER IF EXISTS set_updated_at_media ON public.media_library;

-- 3. Drop helper functions
DROP FUNCTION IF EXISTS public.update_modified_column() CASCADE;
DROP FUNCTION IF EXISTS public.search_similar_content(VECTOR(384), REAL, INTEGER, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_streak(UUID) CASCADE;

-- 4. Drop tables (order matters — child tables first)
DROP TABLE IF EXISTS public.sync_log CASCADE;
DROP TABLE IF EXISTS public.daily_stats CASCADE;
DROP TABLE IF EXISTS public.media_library CASCADE;
DROP TABLE IF EXISTS public.daily_worklogs CASCADE;
DROP TABLE IF EXISTS public.focus_sessions CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- 5. Drop extensions (uncomment if you want to fully nuke)
-- DROP EXTENSION IF EXISTS "vector" CASCADE;
-- DROP EXTENSION IF EXISTS "pgcrypto" CASCADE;
-- DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;
