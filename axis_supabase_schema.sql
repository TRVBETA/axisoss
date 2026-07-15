/* ==========================================
   AXIS OS // Complete Supabase Postgres Schema & Storage Pipeline
   Target: Supabase SQL Editor
   Philosophy: Fighter Jet Fortress. One Execution to lock all data structures.
   ========================================== */

-- ==========================================
-- 1. CONFIGURE DATABASE SECURITY & WAL MODE
-- ==========================================
-- Disable statement timeout for complete execution
SET statement_timeout = 0;

-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 2. CORE TELEMETRY & ACCOUNTABILITY TABLES
-- ==========================================

-- Commander Profile & Telemetry Setup
CREATE TABLE IF NOT EXISTS public.commander_profile (
    id text PRIMARY KEY DEFAULT 'axis_actual',
    commander_name text NOT NULL DEFAULT 'ALEX MERCER',
    current_theme text NOT NULL DEFAULT 'violet',
    streak_current integer NOT NULL DEFAULT 12,
    streak_longest integer NOT NULL DEFAULT 24,
    last_break_date date NOT NULL DEFAULT '2026-05-01',
    total_revolution_score integer NOT NULL DEFAULT 1420,
    updated_at timestamptz DEFAULT now()
);

-- Daily 100-Point Score Debrief Logs
CREATE TABLE IF NOT EXISTS public.daily_debrief_logs (
    log_date date PRIMARY KEY DEFAULT CURRENT_DATE,
    gym_logged boolean DEFAULT false,
    gym_split_name text DEFAULT 'None',
    design_hours numeric(4,1) DEFAULT 0.0,
    sleep_hours numeric(4,1) DEFAULT 0.0,
    water_liters numeric(3,1) DEFAULT 0.0,
    went_outside boolean DEFAULT false,
    watched_tutorial boolean DEFAULT false,
    daily_score integer DEFAULT 0 CHECK (daily_score >= 0 AND daily_score <= 100),
    created_at timestamptz DEFAULT now()
);

-- ==========================================
-- 3. LIBRARY MODULE (CANONICAL ARCHIVES)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.library_books (
    id text PRIMARY KEY, -- match exact custom timestamp keys (e.g. lib-1718841234)
    title text NOT NULL,
    author text NOT NULL,
    book_type text NOT NULL CHECK (book_type IN ('epub', 'pdf')),
    curr_page integer NOT NULL DEFAULT 0,
    total_pages integer NOT NULL DEFAULT 300,
    carry_forward boolean NOT NULL DEFAULT true,
    storage_path text, -- file identifier inside the Supabase Storage bucket
    created_at timestamptz DEFAULT now()
);

-- Index for instant carry-forward query queue
CREATE INDEX IF NOT EXISTS idx_lib_carry_queue ON public.library_books(carry_forward) WHERE carry_forward = true;

-- ==========================================
-- 4. IP METHOD GYM BOT (FITNESS MODULE)
-- ==========================================

-- Core Movement Patterns
CREATE TABLE IF NOT EXISTS public.fitness_movements (
    pattern_name text PRIMARY KEY,
    display_name text NOT NULL
);

-- Tactical Split Sessions
CREATE TABLE IF NOT EXISTS public.fitness_sessions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    split_name text NOT NULL, -- 'Chest + Back', 'Shoulders + Arms', 'Legs'
    logged_at timestamptz DEFAULT now()
);

-- Sets & e1RM Telemetry
CREATE TABLE IF NOT EXISTS public.fitness_sets (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id uuid REFERENCES public.fitness_sessions(id) ON DELETE CASCADE,
    exercise_name text NOT NULL,
    set_type text NOT NULL CHECK (set_type IN ('leading', 'backoff', 'accessory')),
    set_classification text,
    rir numeric(4,2),
    effort_note text,
    is_warmup boolean DEFAULT false,
    weight numeric(5,1) NOT NULL,
    reps integer NOT NULL,
    e1rm numeric(5,1) NOT NULL, -- Computed as: round(weight * (1 + reps * 0.0333))
    logged_at timestamptz DEFAULT now()
);

ALTER TABLE public.fitness_sets ADD COLUMN IF NOT EXISTS set_classification text;
ALTER TABLE public.fitness_sets ADD COLUMN IF NOT EXISTS rir numeric(4,2);
ALTER TABLE public.fitness_sets ADD COLUMN IF NOT EXISTS effort_note text;
ALTER TABLE public.fitness_sets ADD COLUMN IF NOT EXISTS is_warmup boolean DEFAULT false;

-- ==========================================
-- 5. CIRCADIAN TELEMETRY (SLEEP MODULE)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.sleep_circadian_logs (
    log_date date PRIMARY KEY DEFAULT CURRENT_DATE,
    hours_slept numeric(4,1) NOT NULL,
    wake_time text NOT NULL,
    quality_rating integer CHECK (quality_rating >= 1 AND quality_rating <= 5),
    source_bridge text DEFAULT 'iOS Health Shortcuts Bridge',
    logged_at timestamptz DEFAULT now()
);

-- ==========================================
-- 6. PRIVATE SPOTIFY (MUSIC MODULE)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.music_private_projects (
    id text PRIMARY KEY,
    title text NOT NULL,
    artist text NOT NULL,
    cover_art_url text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.music_tracks (
    id text PRIMARY KEY,
    project_id text REFERENCES public.music_private_projects(id) ON DELETE CASCADE,
    track_name text NOT NULL,
    duration text NOT NULL DEFAULT '03:30',
    audio_storage_path text, -- raw .mp3 / .wav identifier in storage
    is_procedural_synth boolean DEFAULT false,
    synth_base_freq numeric(6,2) DEFAULT 130.81,
    created_at timestamptz DEFAULT now()
);

-- ==========================================
-- 7. CREATIVE STUDIO (DESIGN MODULE)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.design_commercial_accounts (
    id text PRIMARY KEY,
    project_name text NOT NULL,
    ref_code text NOT NULL,
    status_badge text NOT NULL DEFAULT 'ACTIVE // NEXT',
    accent_color text DEFAULT 'var(--hud-optimal)',
    sprint_progress integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.design_sprint_tasks (
    id text PRIMARY KEY,
    account_id text REFERENCES public.design_commercial_accounts(id) ON DELETE CASCADE,
    task_title text NOT NULL,
    is_completed boolean DEFAULT false,
    carry_forward boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- ==========================================
-- 8. SUPABASE STORAGE BUCKET PIPELINE
-- Automatic SQL deployment of cloud binary storage
-- ==========================================

-- Deposit 'axis_files' cloud bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('axis_files', 'axis_files', true)
ON CONFLICT (id) DO NOTHING;

-- Establish Security Policies for cloud storage
-- 1. Allow full public READ capability
CREATE POLICY "Enable public READ capability for AXIS binary files" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'axis_files');

-- 2. Allow autonomous POST capability for Commander insertions
CREATE POLICY "Enable authenticated and anon POST capability for AXIS binary files" ON storage.objects
    FOR INSERT TO public
    WITH CHECK (bucket_id = 'axis_files');

CREATE POLICY "Enable Commander DELETE capability for AXIS binary files" ON storage.objects
    FOR DELETE TO public
    USING (bucket_id = 'axis_files');

-- Disable Row Level Security (RLS) barriers on our dedicated fortress tables
-- To guarantee zero-friction POSTs and PATCHs from our Vercel Serverless Webhook
ALTER TABLE public.commander_profile DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_debrief_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_books DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fitness_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fitness_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fitness_sets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sleep_circadian_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.music_private_projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.music_tracks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.design_commercial_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.design_sprint_tasks DISABLE ROW LEVEL SECURITY;

-- ==========================================
-- 9. NUTRITION LOGS (MERGED FROM NUTBOT)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.nutrition_logs (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    description text NOT NULL,
    quantity numeric(8,2) NOT NULL,
    unit text NOT NULL,
    calories numeric(8,2) NOT NULL DEFAULT 0,
    protein numeric(8,2) NOT NULL DEFAULT 0,
    carbs numeric(8,2) NOT NULL DEFAULT 0,
    fat numeric(8,2) NOT NULL DEFAULT 0,
    source text DEFAULT 'axis_web',
    logged_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nutrition_logs_logged_at ON public.nutrition_logs(logged_at DESC);
ALTER TABLE public.nutrition_logs DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.nutrition_custom_foods (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL UNIQUE,
    aliases text DEFAULT '',
    calories_per_100g numeric(8,2) NOT NULL DEFAULT 0,
    protein_per_100g numeric(8,2) NOT NULL DEFAULT 0,
    carbs_per_100g numeric(8,2) NOT NULL DEFAULT 0,
    fat_per_100g numeric(8,2) NOT NULL DEFAULT 0,
    grams_per_piece numeric(8,2),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nutrition_meal_templates (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL UNIQUE,
    body_text text NOT NULL,
    default_mode text NOT NULL DEFAULT 'auto',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nutrition_custom_foods_name ON public.nutrition_custom_foods(name);
CREATE INDEX IF NOT EXISTS idx_nutrition_meal_templates_name ON public.nutrition_meal_templates(name);
ALTER TABLE public.nutrition_custom_foods DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_meal_templates DISABLE ROW LEVEL SECURITY;

-- ==========================================
-- 10. QUICK CLIPBOARD MEMORY
-- ==========================================

CREATE TABLE IF NOT EXISTS public.clipboard_items (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    content text NOT NULL,
    source text DEFAULT 'axis_web',
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clipboard_items_created_at ON public.clipboard_items(created_at DESC);
ALTER TABLE public.clipboard_items DISABLE ROW LEVEL SECURITY;

-- ==========================================
-- 11. CORE DASHBOARD DATA
-- ==========================================

CREATE TABLE IF NOT EXISTS public.core_balance (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    label text NOT NULL DEFAULT 'Main Balance',
    amount numeric(12,2) NOT NULL DEFAULT 0,
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.core_todos (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    title text NOT NULL,
    is_done boolean NOT NULL DEFAULT false,
    is_daily boolean NOT NULL DEFAULT false,
    points integer NOT NULL DEFAULT 1,
    last_reset_key text,
    completed_day_key text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.core_todos ADD COLUMN IF NOT EXISTS is_daily boolean NOT NULL DEFAULT false;
ALTER TABLE public.core_todos ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 1;
ALTER TABLE public.core_todos ADD COLUMN IF NOT EXISTS last_reset_key text;
ALTER TABLE public.core_todos ADD COLUMN IF NOT EXISTS completed_day_key text;

CREATE INDEX IF NOT EXISTS idx_core_todos_created_at ON public.core_todos(created_at DESC);
ALTER TABLE public.core_balance DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.core_todos DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.core_task_events (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id uuid,
    event_type text NOT NULL,
    title_snapshot text,
    points_snapshot integer DEFAULT 1,
    is_daily_snapshot boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_core_task_events_created_at ON public.core_task_events(created_at DESC);
ALTER TABLE public.core_task_events DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.axis_markers (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    title text NOT NULL,
    marker_type text NOT NULL DEFAULT 'deadline',
    target_date date NOT NULL,
    is_done boolean NOT NULL DEFAULT false,
    note text DEFAULT '',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_axis_markers_target_date ON public.axis_markers(target_date ASC);
ALTER TABLE public.axis_markers DISABLE ROW LEVEL SECURITY;

-- ==========================================
-- 12. JOURNAL STREAM
-- ==========================================

CREATE TABLE IF NOT EXISTS public.journal_entries (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    content text NOT NULL,
    entry_type text NOT NULL DEFAULT 'thought',
    tags text DEFAULT '',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_created_at ON public.journal_entries(created_at DESC);
ALTER TABLE public.journal_entries DISABLE ROW LEVEL SECURITY;

-- ==========================================
-- 13. NOTIFICATION RULES
-- ==========================================

CREATE TABLE IF NOT EXISTS public.notification_rules (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    title text NOT NULL DEFAULT 'AXIS Reminder',
    message text NOT NULL DEFAULT 'AXIS notification',
    enabled boolean NOT NULL DEFAULT true,
    start_at timestamptz NOT NULL DEFAULT now(),
    repeat_value integer NOT NULL DEFAULT 1,
    repeat_unit text NOT NULL DEFAULT 'hours',
    last_fired_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_rules_created_at ON public.notification_rules(created_at DESC);
ALTER TABLE public.notification_rules DISABLE ROW LEVEL SECURITY;

SELECT '⚡ AXIS ACTUAL // COMPLETE SUPABASE POSTGRES SCHEMA DEFINED AND DEPLOYED.' as telemetry_confirmation;