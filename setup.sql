-- AXIS Ranks & Milestones — schema delta
-- Run against the Supabase project before deploying rank support.
-- Idempotent: safe to re-run.

-- 10-rank ladder. Names/labels/thresholds are user-editable in the UI.
-- level 10 has min_count = null (the "???" rank, never auto-reached).
create table if not exists public.axis_ranks (
  level       integer primary key,
  name        text not null default '',
  short_label text not null default '',
  min_count   integer,
  color       text not null default '#8c8a84',
  updated_at  timestamptz not null default now()
);

alter table public.axis_ranks disable row level security;

-- Milestone checklist. User-authored; `achieved_at` null = not done.
create table if not exists public.axis_milestones (
  id          text primary key,
  title       text not null default '',
  note        text not null default '',
  achieved_at timestamptz,
  created_at  timestamptz not null default now()
);

alter table public.axis_milestones disable row level security;
