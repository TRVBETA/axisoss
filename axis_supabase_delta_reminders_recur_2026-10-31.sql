-- AXIS Reminders — recurrence + sweep dedupe + payload_kind
-- Adds:
--   1. dedupe_key: unique constraint the sweep uses so a generated
--      reminder can only exist once per logical day. INSERT with
--      Prefer: resolution=merge-duplicates is a no-op when the key exists.
--   2. payload_kind: 'none' (plain) | 'tasks' | 'mfp'. The long-poll
--      endpoint rewrites the body of tasks/mfp reminders at DELIVERY time
--      so the user always sees fresh data, not a snapshot from sweep time.
--   3. afternoon_hour / bedtime_hour on commander_profile: when the sweep
--      should generate the afternoon and bedtime reminders. Fall back to
--      env vars AXIS_AFTERNOON_HOUR / AXIS_BEDTIME_HOUR, then 14 / 22.
--
-- Idempotent. Safe to re-run.

ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS dedupe_key text;
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS payload_kind text DEFAULT 'none';

CREATE UNIQUE INDEX IF NOT EXISTS reminders_dedupe_key_idx
    ON public.reminders (dedupe_key)
    WHERE dedupe_key IS NOT NULL;

ALTER TABLE public.commander_profile ADD COLUMN IF NOT EXISTS afternoon_hour integer DEFAULT 14;
ALTER TABLE public.commander_profile ADD COLUMN IF NOT EXISTS bedtime_hour integer DEFAULT 22;

-- Which surfaces a generated reminder should reach. 'toast' = the Windows
-- tray app (default). 'telegram' = the AXIS Telegram bot. 'both' = both.
-- A separate column per surface keeps the two delivery paths from racing
-- each other: the long-poll writes delivered_at, the telegram sender writes
-- telegram_sent_at, and each ignores reminders already handled by itself.
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS channels text DEFAULT 'toast';
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS telegram_sent_at timestamptz;