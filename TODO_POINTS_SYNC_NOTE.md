# Todo Points Sync Note

If todo completion does not change the Core daily score, the usual causes are:

1. `core_todos.completed_day_key` column is missing in Supabase
2. the latest `core.js` was not uploaded/deployed
3. the latest `lib/coreDataServer.js` or `lib/dailyServer.js` was not uploaded/deployed

## Required SQL
```sql
ALTER TABLE public.core_todos ADD COLUMN IF NOT EXISTS is_daily boolean NOT NULL DEFAULT false;
ALTER TABLE public.core_todos ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 1;
ALTER TABLE public.core_todos ADD COLUMN IF NOT EXISTS last_reset_key text;
ALTER TABLE public.core_todos ADD COLUMN IF NOT EXISTS completed_day_key text;
```

## Behavior
- checking a todo sets `completed_day_key`
- daily score reads today’s completed todo points
- after toggling a todo, Core should reload daily telemetry and refresh score
