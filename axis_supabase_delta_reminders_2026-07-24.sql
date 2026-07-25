-- AXIS Reminders — schema delta
-- Run against the Supabase project before deploying api/reminders.js
-- Idempotent: safe to re-run.

create table if not exists public.reminders (
  id            bigserial primary key,
  user_id       text not null default 'axis',
  title         text not null,
  body          text not null default '',
  fire_at       timestamptz not null,
  status        text not null default 'pending',  -- 'pending' | 'delivered' | 'cancelled'
  repeat_interval text not null default '',     -- 'daily' | 'weekly' | 'hourly' | '' (none)
  created_at    timestamptz not null default now(),
  delivered_at  timestamptz
);

-- Index for the long-poll query: "give me reminders that are due for this user"
create index if not exists reminders_user_status_fire_idx
  on public.reminders (user_id, status, fire_at);

-- RLS: keep the table closed off. The server uses the service role key, the
-- browser never talks to Supabase directly for reminders.
alter table public.reminders enable row level security;

drop policy if exists reminders_no_direct_access on public.reminders;
create policy reminders_no_direct_access on public.reminders
  for all
  using (false)
  with check (false);
