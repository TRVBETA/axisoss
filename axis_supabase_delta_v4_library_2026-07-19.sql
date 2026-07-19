-- AXIS delta SQL
-- Apply this if your database is behind the V4 scoring + library/storage builds.
-- Safe to rerun.

SET statement_timeout = 0;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================
-- FITNESS extra telemetry fields
-- =========================================================
ALTER TABLE public.fitness_sets ADD COLUMN IF NOT EXISTS set_classification text;
ALTER TABLE public.fitness_sets ADD COLUMN IF NOT EXISTS rir numeric(4,2);
ALTER TABLE public.fitness_sets ADD COLUMN IF NOT EXISTS effort_note text;
ALTER TABLE public.fitness_sets ADD COLUMN IF NOT EXISTS is_warmup boolean DEFAULT false;
ALTER TABLE public.fitness_sets DISABLE ROW LEVEL SECURITY;

-- =========================================================
-- NUTRITION custom foods + meal templates
-- =========================================================
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

-- =========================================================
-- MARKERS
-- =========================================================
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

-- =========================================================
-- LIBRARY
-- =========================================================
CREATE TABLE IF NOT EXISTS public.library_books (
    id text PRIMARY KEY,
    title text NOT NULL,
    author text NOT NULL,
    book_type text NOT NULL CHECK (book_type IN ('epub', 'pdf')),
    curr_page integer NOT NULL DEFAULT 0,
    total_pages integer NOT NULL DEFAULT 300,
    carry_forward boolean NOT NULL DEFAULT true,
    storage_path text,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lib_carry_queue ON public.library_books(carry_forward) WHERE carry_forward = true;
ALTER TABLE public.library_books DISABLE ROW LEVEL SECURITY;

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

-- =========================================================
-- DAILY V4 fields
-- =========================================================
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
ALTER TABLE public.daily_debrief_logs DISABLE ROW LEVEL SECURITY;

-- =========================================================
-- CORE TODO V4 fields
-- =========================================================
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
ALTER TABLE public.core_todos DISABLE ROW LEVEL SECURITY;

-- =========================================================
-- CORE task history V4 fields
-- =========================================================
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
ALTER TABLE public.core_task_events DISABLE ROW LEVEL SECURITY;

-- =========================================================
-- NOTE
-- =========================================================
-- The latest task-based momentum/streak update does NOT require new SQL.
-- It runs from existing core_task_events completion history.
