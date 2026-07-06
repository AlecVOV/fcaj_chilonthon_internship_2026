-- ============================================================================
-- Focus Mode App — Supabase PostgreSQL + pgvector Schema
-- Cloud-Native Architecture (Supabase Cloud Managed Free Tier)
-- Generated for GitHub Copilot (DeepSeek) project context
-- ============================================================================

-- 1. Enable required extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";        -- Cryptographic functions
CREATE EXTENSION IF NOT EXISTS "vector";          -- pgvector for RAG embeddings

-- ============================================================================
-- 2. Core Tables
-- ============================================================================

-- 2.1 Users (managed via Supabase Auth — this table mirrors auth.users)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           TEXT NOT NULL UNIQUE,
    display_name    TEXT,
    role            TEXT NOT NULL DEFAULT 'user'
                    CHECK (role IN ('user', 'admin')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2.2 Tasks (To-do list by user)
-- NOTE: review column stores post-completion review text (feature added June 2026)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    description     TEXT,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    priority        SMALLINT NOT NULL DEFAULT 0
                    CHECK (priority BETWEEN 0 AND 3),  -- 0=none, 1=low, 2=medium, 3=high
    duration_spent  INTEGER NOT NULL DEFAULT 0,        -- accumulated seconds
    due_date        DATE,
    review          TEXT,                               -- post-completion review / reflection
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX idx_tasks_status ON public.tasks(user_id, status);
CREATE INDEX idx_tasks_updated ON public.tasks(updated_at);

CREATE TRIGGER set_updated_at_tasks
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

-- 2.3 Focus Sessions (individual Pomodoro / focus blocks)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.focus_sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    task_id         UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    start_time      TIMESTAMPTZ NOT NULL,
    end_time        TIMESTAMPTZ,
    duration_planned INTEGER NOT NULL,                -- planned seconds (e.g. 1500 = 25 min)
    duration_actual  INTEGER,                         -- actual seconds (end_time - start_time)
    journal_text    TEXT CHECK (char_length(journal_text) <= 1000),
    emotion_label   TEXT
                    CHECK (emotion_label IN ('focused', 'stressed', 'exhausted', 'relaxed', 'unmotivated')),
    emotion_confidence REAL CHECK (emotion_confidence BETWEEN 0 AND 1),
    ambient_track   TEXT,                             -- URL or key of ambient sound played
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON public.focus_sessions(user_id);
CREATE INDEX idx_sessions_user_date ON public.focus_sessions(user_id, start_time);
CREATE INDEX idx_sessions_updated ON public.focus_sessions(updated_at);

CREATE TRIGGER set_updated_at_sessions
    BEFORE UPDATE ON public.focus_sessions
    FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

-- 2.4 Daily Worklogs (aggregated nightly by Lambda, for Dashboard & Reports)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_worklogs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    date            DATE NOT NULL,
    total_focus_time INTEGER NOT NULL DEFAULT 0,      -- total seconds for the day
    sessions_count  INTEGER NOT NULL DEFAULT 0,
    tasks_completed INTEGER NOT NULL DEFAULT 0,
    mood_summary    TEXT,                             -- aggregated emotion summary text
    dominant_emotion TEXT,                            -- most frequent emotion_label
    latex_file_url  TEXT,                             -- S3 URL to generated .tex file
    pdf_file_url    TEXT,                             -- S3 URL to generated .pdf report
    email_sent      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, date)                             -- one worklog per user per day
);

CREATE INDEX idx_worklogs_user_id ON public.daily_worklogs(user_id);
CREATE INDEX idx_worklogs_date ON public.daily_worklogs(date);

CREATE TRIGGER set_updated_at_worklogs
    BEFORE UPDATE ON public.daily_worklogs
    FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

-- 2.5 Media Library (RAG content store — quotes, sutras, videos)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.media_library (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title           TEXT NOT NULL,
    content_text    TEXT,                             -- raw text content for embedding
    content_url     TEXT,                             -- URL to external resource (YouTube, etc.)
    type            TEXT NOT NULL
                    CHECK (type IN ('quote', 'sutra', 'video', 'article', 'audio')),
    source          TEXT,                             -- e.g., "Lamrim Class 2023", "Khangser Rinpoche"
    tags            TEXT[],                           -- array of tags for filtering
    embedding_vector VECTOR(384),                     -- all-MiniLM-L6-v2 embedding (384 dims)
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      UUID REFERENCES public.users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- pgvector index for similarity search
CREATE INDEX idx_media_embedding ON public.media_library
    USING ivfflat (embedding_vector vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX idx_media_type ON public.media_library(type);
CREATE INDEX idx_media_active ON public.media_library(is_active);

CREATE TRIGGER set_updated_at_media
    BEFORE UPDATE ON public.media_library
    FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

-- 2.6 Daily Stats (pre-computed analytics for Dashboard, populated nightly)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_stats (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    date            DATE NOT NULL,
    total_focus_seconds INTEGER NOT NULL DEFAULT 0,
    sessions_count  INTEGER NOT NULL DEFAULT 0,
    tasks_created   INTEGER NOT NULL DEFAULT 0,
    tasks_completed INTEGER NOT NULL DEFAULT 0,
    avg_session_minutes REAL NOT NULL DEFAULT 0,
    streak_days     INTEGER NOT NULL DEFAULT 0,       -- consecutive focus days
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, date)
);

CREATE INDEX idx_stats_user_id ON public.daily_stats(user_id);
CREATE INDEX idx_stats_date ON public.daily_stats(date);

-- ============================================================================
-- 3. Sync Queue Table (for Drift ↔ Supabase reconciliation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sync_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name      TEXT NOT NULL,                    -- 'tasks', 'focus_sessions', etc.
    record_id       UUID NOT NULL,
    operation       TEXT NOT NULL
                    CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    payload         JSONB,                            -- full row data at time of sync
    client_updated_at TIMESTAMPTZ NOT NULL,           -- Drift-side timestamp
    server_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved        BOOLEAN NOT NULL DEFAULT FALSE,
    resolution      TEXT,                             -- 'applied', 'discarded', 'merged'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sync_log_table ON public.sync_log(table_name, record_id);
CREATE INDEX idx_sync_log_resolved ON public.sync_log(resolved);

-- ============================================================================
-- 4. Helper Functions
-- ============================================================================

-- 4.1 RAG similarity search (cosine distance, smaller = more similar)
CREATE OR REPLACE FUNCTION public.search_similar_content(
    query_embedding VECTOR(384),
    match_threshold REAL DEFAULT 0.3,
    match_count INTEGER DEFAULT 5,
    filter_type TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    content_text TEXT,
    content_url TEXT,
    type TEXT,
    source TEXT,
    similarity REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ml.id,
        ml.title,
        ml.content_text,
        ml.content_url,
        ml.type,
        ml.source,
        1 - (ml.embedding_vector <=> query_embedding) AS similarity
    FROM public.media_library ml
    WHERE ml.is_active = TRUE
      AND ml.embedding_vector IS NOT NULL
      AND (filter_type IS NULL OR ml.type = filter_type)
      AND 1 - (ml.embedding_vector <=> query_embedding) > match_threshold
    ORDER BY ml.embedding_vector <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- 4.2 Get user streak (consecutive days with focus sessions)
CREATE OR REPLACE FUNCTION public.get_user_streak(
    p_user_id UUID
)
RETURNS INTEGER AS $$
DECLARE
    streak INTEGER := 0;
    today DATE := CURRENT_DATE;
    check_date DATE := today;
BEGIN
    LOOP
        IF EXISTS (
            SELECT 1 FROM public.daily_worklogs
            WHERE user_id = p_user_id AND date = check_date AND total_focus_time > 0
        ) THEN
            streak := streak + 1;
            check_date := check_date - INTERVAL '1 day';
        ELSE
            EXIT;
        END IF;
    END LOOP;
    RETURN streak;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. Row-Level Security (RLS) Policies
-- ============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_worklogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_library ENABLE ROW LEVEL SECURITY;

-- Users: can only read/update own row
CREATE POLICY users_self_access ON public.users
    FOR ALL USING (auth.uid() = id);

-- Tasks: CRUD limited to owner
CREATE POLICY tasks_owner_access ON public.tasks
    FOR ALL USING (auth.uid() = user_id);

-- Focus Sessions: CRUD limited to owner
CREATE POLICY sessions_owner_access ON public.focus_sessions
    FOR ALL USING (auth.uid() = user_id);

-- Daily Worklogs: read limited to owner; insert by service_role (Lambda)
CREATE POLICY worklogs_owner_select ON public.daily_worklogs
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY worklogs_service_insert ON public.daily_worklogs
    FOR INSERT WITH CHECK (TRUE);  -- Lambda uses service_role key

-- Daily Stats: read limited to owner; insert by service_role (Lambda)
CREATE POLICY stats_owner_select ON public.daily_stats
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY stats_service_insert ON public.daily_stats
    FOR INSERT WITH CHECK (TRUE);

-- Media Library: read all authenticated users; write admin only
CREATE POLICY media_read_all ON public.media_library
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY media_write_admin ON public.media_library
    FOR INSERT WITH CHECK (auth.uid() IN (
        SELECT id FROM public.users WHERE email LIKE '%@admin.focusapp.dev'
    ));
CREATE POLICY media_update_admin ON public.media_library
    FOR UPDATE USING (auth.uid() IN (
        SELECT id FROM public.users WHERE email LIKE '%@admin.focusapp.dev'
    ));
