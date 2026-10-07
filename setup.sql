/* ================================================================
   AXIS // setup.sql — complete database setup in ONE file.
   Paste into Supabase → SQL Editor → Run.
   Safe to rerun any number of times (idempotent).
   Replaces every old axis_supabase_*.sql file (now archived).
   ================================================================ */

SET statement_timeout = 0;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------
-- 1. PROFILE + DAILY TELEMETRY
-- ------------------------------------------
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
    fitness_score_v4 integer DEFAULT 0,
    nutrition_score_v4 integer DEFAULT 0,
    sleep_score_v4 integer DEFAULT 0,
    reading_score_v4 integer DEFAULT 0,
    destiny_tier integer DEFAULT 0,
    destiny_title text DEFAULT '',
    destiny_bonus_points integer DEFAULT 0,
    destiny_proof_url text DEFAULT '',
    effort_v4 integer DEFAULT 0,
    day_score_v4 integer DEFAULT 0,
    grade_v4 text DEFAULT 'ROT',
    primary_mode_v4 text DEFAULT 'desk',
    desk_eff_v4 integer DEFAULT 0,
    uni_eff_v4 integer DEFAULT 0,
    field_eff_v4 integer DEFAULT 0,
    farming_ratio_v4 numeric(6,2) DEFAULT 0,
    must_win_done_v4 boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.daily_debrief_logs ADD COLUMN IF NOT EXISTS fitness_score_v4 integer DEFAULT 0;
ALTER TABLE public.daily_debrief_logs ADD COLUMN IF NOT EXISTS nutrition_score_v4 integer DEFAULT 0;
ALTER TABLE public.daily_debrief_logs ADD COLUMN IF NOT EXISTS sleep_score_v4 integer DEFAULT 0;
ALTER TABLE public.daily_debrief_logs ADD COLUMN IF NOT EXISTS reading_score_v4 integer DEFAULT 0;
ALTER TABLE public.daily_debrief_logs ADD COLUMN IF NOT EXISTS destiny_tier integer DEFAULT 0;
ALTER TABLE public.daily_debrief_logs ADD COLUMN IF NOT EXISTS destiny_title text DEFAULT '';
ALTER TABLE public.daily_debrief_logs ADD COLUMN IF NOT EXISTS destiny_bonus_points integer DEFAULT 0;
ALTER TABLE public.daily_debrief_logs ADD COLUMN IF NOT EXISTS destiny_proof_url text DEFAULT '';
ALTER TABLE public.daily_debrief_logs ADD COLUMN IF NOT EXISTS effort_v4 integer DEFAULT 0;
ALTER TABLE public.daily_debrief_logs ADD COLUMN IF NOT EXISTS day_score_v4 integer DEFAULT 0;
ALTER TABLE public.daily_debrief_logs ADD COLUMN IF NOT EXISTS grade_v4 text DEFAULT 'ROT';
ALTER TABLE public.daily_debrief_logs ADD COLUMN IF NOT EXISTS primary_mode_v4 text DEFAULT 'desk';
ALTER TABLE public.daily_debrief_logs ADD COLUMN IF NOT EXISTS desk_eff_v4 integer DEFAULT 0;
ALTER TABLE public.daily_debrief_logs ADD COLUMN IF NOT EXISTS uni_eff_v4 integer DEFAULT 0;
ALTER TABLE public.daily_debrief_logs ADD COLUMN IF NOT EXISTS field_eff_v4 integer DEFAULT 0;
ALTER TABLE public.daily_debrief_logs ADD COLUMN IF NOT EXISTS farming_ratio_v4 numeric(6,2) DEFAULT 0;
ALTER TABLE public.daily_debrief_logs ADD COLUMN IF NOT EXISTS must_win_done_v4 boolean DEFAULT false;

-- ------------------------------------------
-- 2. CORE (todos, events, markers, balance)
-- ------------------------------------------
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
    task_kind text NOT NULL DEFAULT 'task',
    mode text NOT NULL DEFAULT 'desk',
    impact integer NOT NULL DEFAULT 1,
    resistance integer NOT NULL DEFAULT 1,
    depth integer NOT NULL DEFAULT 0,
    points_auto integer NOT NULL DEFAULT 1,
    must_win boolean NOT NULL DEFAULT false,
    done_definition text DEFAULT '',
    status text NOT NULL DEFAULT 'committed',
    committed_at timestamptz,
    incoming_critical boolean NOT NULL DEFAULT false,
    last_reset_key text,
    completed_day_key text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.core_todos ADD COLUMN IF NOT EXISTS is_daily boolean NOT NULL DEFAULT false;
ALTER TABLE public.core_todos ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 1;
ALTER TABLE public.core_todos ADD COLUMN IF NOT EXISTS task_kind text NOT NULL DEFAULT 'task';
ALTER TABLE public.core_todos ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'desk';
ALTER TABLE public.core_todos ADD COLUMN IF NOT EXISTS impact integer NOT NULL DEFAULT 1;
ALTER TABLE public.core_todos ADD COLUMN IF NOT EXISTS resistance integer NOT NULL DEFAULT 1;
ALTER TABLE public.core_todos ADD COLUMN IF NOT EXISTS depth integer NOT NULL DEFAULT 0;
ALTER TABLE public.core_todos ADD COLUMN IF NOT EXISTS points_auto integer NOT NULL DEFAULT 1;
ALTER TABLE public.core_todos ADD COLUMN IF NOT EXISTS must_win boolean NOT NULL DEFAULT false;
ALTER TABLE public.core_todos ADD COLUMN IF NOT EXISTS done_definition text DEFAULT '';
ALTER TABLE public.core_todos ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'committed';
ALTER TABLE public.core_todos ADD COLUMN IF NOT EXISTS committed_at timestamptz;
ALTER TABLE public.core_todos ADD COLUMN IF NOT EXISTS incoming_critical boolean NOT NULL DEFAULT false;
ALTER TABLE public.core_todos ADD COLUMN IF NOT EXISTS last_reset_key text;
ALTER TABLE public.core_todos ADD COLUMN IF NOT EXISTS completed_day_key text;
CREATE INDEX IF NOT EXISTS idx_core_todos_created_at ON public.core_todos(created_at DESC);

CREATE TABLE IF NOT EXISTS public.core_task_events (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id uuid,
    event_type text NOT NULL,
    title_snapshot text,
    points_snapshot integer DEFAULT 1,
    is_daily_snapshot boolean DEFAULT false,
    task_kind_snapshot text DEFAULT 'task',
    mode_snapshot text DEFAULT 'desk',
    day_key text,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.core_task_events ADD COLUMN IF NOT EXISTS task_kind_snapshot text DEFAULT 'task';
ALTER TABLE public.core_task_events ADD COLUMN IF NOT EXISTS mode_snapshot text DEFAULT 'desk';
ALTER TABLE public.core_task_events ADD COLUMN IF NOT EXISTS day_key text;
CREATE INDEX IF NOT EXISTS idx_core_task_events_created_at ON public.core_task_events(created_at DESC);

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

-- ------------------------------------------
-- 3. RANKS + MILESTONES
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.axis_ranks (
    level integer PRIMARY KEY,
    name text NOT NULL DEFAULT '',
    short_label text NOT NULL DEFAULT '',
    min_count integer,
    color text NOT NULL DEFAULT '#8c8a84',
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.axis_milestones (
    id text PRIMARY KEY,
    title text NOT NULL DEFAULT '',
    note text NOT NULL DEFAULT '',
    achieved_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------
-- 4. JOURNAL
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.journal_entries (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    content text NOT NULL,
    entry_type text NOT NULL DEFAULT 'thought',
    tags text DEFAULT '',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_created_at ON public.journal_entries(created_at DESC);

-- ------------------------------------------
-- 5. FITNESS
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.fitness_movements (
    pattern_name text PRIMARY KEY,
    display_name text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.fitness_sessions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    split_name text NOT NULL,
    logged_at timestamptz DEFAULT now()
);

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
    e1rm numeric(5,1) NOT NULL,
    logged_at timestamptz DEFAULT now()
);

ALTER TABLE public.fitness_sets ADD COLUMN IF NOT EXISTS set_classification text;
ALTER TABLE public.fitness_sets ADD COLUMN IF NOT EXISTS rir numeric(4,2);
ALTER TABLE public.fitness_sets ADD COLUMN IF NOT EXISTS effort_note text;
ALTER TABLE public.fitness_sets ADD COLUMN IF NOT EXISTS is_warmup boolean DEFAULT false;

-- ------------------------------------------
-- 6. SLEEP
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.sleep_circadian_logs (
    log_date date PRIMARY KEY DEFAULT CURRENT_DATE,
    hours_slept numeric(4,1) NOT NULL,
    wake_time text NOT NULL,
    quality_rating integer CHECK (quality_rating >= 1 AND quality_rating <= 5),
    source_bridge text DEFAULT 'iOS Health Shortcuts Bridge',
    logged_at timestamptz DEFAULT now()
);

-- ------------------------------------------
-- 7. NUTRITION
-- ------------------------------------------
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

-- ------------------------------------------
-- 8. CLIPBOARD
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.clipboard_items (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    content text NOT NULL,
    source text DEFAULT 'axis_web',
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clipboard_items_created_at ON public.clipboard_items(created_at DESC);

-- ------------------------------------------
-- 9. LIBRARY + STORAGE BUCKET
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.library_books (
    id text PRIMARY KEY,
    title text NOT NULL,
    author text NOT NULL,
    book_type text NOT NULL CHECK (book_type IN ('epub', 'pdf')),
    curr_page integer NOT NULL DEFAULT 0,
    total_pages integer NOT NULL DEFAULT 300,
    carry_forward boolean NOT NULL DEFAULT true,
    storage_path text,
    location_cfi text,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE IF EXISTS public.library_books ADD COLUMN IF NOT EXISTS location_cfi text;
CREATE INDEX IF NOT EXISTS idx_lib_carry_queue ON public.library_books(carry_forward) WHERE carry_forward = true;

-- One-time cleanup carried over from the old CFI delta: normalize fake totals.
UPDATE public.library_books SET total_pages = 100 WHERE total_pages IN (150, 320);

INSERT INTO storage.buckets (id, name, public)
VALUES ('axis_files', 'axis_files', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Enable public READ capability for AXIS binary files" ON storage.objects;
DROP POLICY IF EXISTS "Enable authenticated and anon POST capability for AXIS binary files" ON storage.objects;
DROP POLICY IF EXISTS "Enable Commander DELETE capability for AXIS binary files" ON storage.objects;

CREATE POLICY "Enable public READ capability for AXIS binary files" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'axis_files');

CREATE POLICY "Enable authenticated and anon POST capability for AXIS binary files" ON storage.objects
    FOR INSERT TO public
    WITH CHECK (bucket_id = 'axis_files');

CREATE POLICY "Enable Commander DELETE capability for AXIS binary files" ON storage.objects
    FOR DELETE TO public
    USING (bucket_id = 'axis_files');

-- ------------------------------------------
-- 10. MUSIC + DESIGN (quiet surfaces)
-- ------------------------------------------
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
    audio_storage_path text,
    is_procedural_synth boolean DEFAULT false,
    synth_base_freq numeric(6,2) DEFAULT 130.81,
    created_at timestamptz DEFAULT now()
);

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

-- ------------------------------------------
-- 11. REMINDERS (server-only via service role)
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.reminders (
    id bigserial PRIMARY KEY,
    user_id text NOT NULL DEFAULT 'axis',
    title text NOT NULL,
    body text NOT NULL DEFAULT '',
    fire_at timestamptz NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    repeat_interval text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    delivered_at timestamptz
);

CREATE INDEX IF NOT EXISTS reminders_user_status_fire_idx
    ON public.reminders (user_id, status, fire_at);

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reminders_no_direct_access ON public.reminders;
CREATE POLICY reminders_no_direct_access ON public.reminders
    FOR ALL
    USING (false)
    WITH CHECK (false);

-- ------------------------------------------
-- 12. WANDERER
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.wanderer_visits (
    id bigserial PRIMARY KEY,
    state text NOT NULL,
    zone text NOT NULL,
    line text,
    was_fallback boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wanderer_visits_created_at
    ON public.wanderer_visits (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wanderer_visits_zone
    ON public.wanderer_visits (zone, created_at DESC);

CREATE TABLE IF NOT EXISTS public.wanderer_object_touches (
    id bigserial PRIMARY KEY,
    visit_id bigint REFERENCES public.wanderer_visits(id) ON DELETE CASCADE,
    zone text NOT NULL,
    object_key text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wanderer_object_touches_visit
    ON public.wanderer_object_touches (visit_id);

CREATE INDEX IF NOT EXISTS idx_wanderer_object_touches_zone
    ON public.wanderer_object_touches (zone, object_key, created_at DESC);

-- ------------------------------------------
-- 13. REMOVED SYSTEMS (kept here so reruns stay clean)
-- ------------------------------------------
DROP TABLE IF EXISTS public.notification_rules CASCADE;

-- ------------------------------------------
-- 14. RLS: closed fortress (server key does everything)
-- ------------------------------------------
ALTER TABLE public.commander_profile DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_debrief_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.core_balance DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.core_todos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.core_task_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.axis_markers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.axis_ranks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.axis_milestones DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_books DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fitness_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fitness_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fitness_sets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sleep_circadian_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_custom_foods DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_meal_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clipboard_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.music_private_projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.music_tracks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.design_commercial_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.design_sprint_tasks DISABLE ROW LEVEL SECURITY;
-- reminders stays RLS-locked (section 11) on purpose.

SELECT 'AXIS // FULL SETUP COMPLETE' AS telemetry_confirmation;
