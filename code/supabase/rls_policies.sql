-- ============================================================================
-- Focus Mode App — Row Level Security Policies
-- ============================================================================
-- Apply after running the database migration (00001_initial_schema.sql).
-- Enables RLS on all tables and creates user/role-based access policies.

-- 1. Tasks — users CRUD their own
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users CRUD own tasks" ON public.tasks
  FOR ALL USING (auth.uid() = user_id);

-- 2. Focus Sessions — users CRUD their own
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users CRUD own sessions" ON public.focus_sessions
  FOR ALL USING (auth.uid() = user_id);

-- 3. Daily Worklogs — users read own
ALTER TABLE public.daily_worklogs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own worklogs" ON public.daily_worklogs
  FOR SELECT USING (auth.uid() = user_id);

-- 4. Daily Stats — users read own
ALTER TABLE public.daily_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own stats" ON public.daily_stats
  FOR SELECT USING (auth.uid() = user_id);

-- 5. Media Library — anyone authenticated can read, only admin can modify
ALTER TABLE public.media_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read media" ON public.media_library
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins manage media" ON public.media_library
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- 6. Users — users read/update own, admins read all
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins read all users" ON public.users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- 7. Sync Log — service-level access only
ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service full access to sync log" ON public.sync_log
  FOR ALL USING (auth.role() = 'service_role');
