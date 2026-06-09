-- ============================================================================
-- Focus Mode App — Row Level Security Policies
-- ============================================================================
-- Apply after running the database migration.
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

-- 4. Media Library — anyone can read, only admin can modify
ALTER TABLE public.media_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read media" ON public.media_library
  FOR SELECT USING (true);
CREATE POLICY "Admins manage media" ON public.media_library
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 5. User Requests — anyone can insert, admins read/write
ALTER TABLE public.user_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert requests" ON public.user_requests
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins read/write requests" ON public.user_requests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 6. Profiles — users read/update own, admins read all
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins read all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
