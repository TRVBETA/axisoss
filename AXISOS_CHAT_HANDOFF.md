# AXISOS Chat Handoff

Last updated: 2026-07-20

Use this file first if a future chat loses context.

## Current repo
- Working repo: `/home/user/repo_latest`
- Latest SQL delta: `/home/user/repo_latest/axis_supabase_delta_v4_library_2026-07-19.sql`
- Latest zip should be regenerated from the current repo before handoff if new changes were made after the last export.

## Product identity
AXIS / AXISOS is a private personal operating system dashboard.

Current design intent:
- true-black base
- floating capsule top shell
- premium spacing
- low text noise
- restrained dune/gold accent
- strong focus on Core / Tasks / Fitness / Nutrition

## What is real and working now
### Server-backed areas
- auth
- daily telemetry / V4 scoring
- core todos + task events
- clipboard
- fitness logging
- nutrition logging
- sleep logging
- library metadata + file sync
- Telegram bot route

### V4 scoring state
- V4 task model is integrated into backend and Core UI
- sleep / fitness / nutrition feed Core
- task momentum is now derived from `core_task_events`
- ritual streaks still exist, but main momentum is task-based

### Telegram state
- one real bot route: `api/telegram.js`
- supports workout / nutrition / task matching / voice transcription path
- GET probe now reports whether deploy is online / degraded / unconfigured
- true human-side live verification still requires the user to message the bot after deploy

### Library state
- rebuilt to avoid blocked CDN dependencies
- EPUB engine is bundled locally in `vendor/epub.min.js`
- PDF uses native in-app iframe/blob path
- local-first with server fallback for missing binaries

## Current known issues / caution
- modal shell behavior still needs one more focused hardening pass if popups feel off-center or scroll badly with long content
- Core has been edited many times; prefer careful cleanup over broad rewrites
- sleep page shell was removed from main app, but `sleep.js` is still loaded for background sync support
- journal / notifications shells were removed from `index.html`

## User priorities right now
1. reminders / accountability pressure
2. tasks
3. fitness
4. nutrition
5. stable clean UX without drift

## Next recommended feature
Build reminder system before any desktop app.
Best delivery order:
1. server reminder engine
2. Telegram reminders
3. optional browser push
4. optional tiny desktop notifier later

## Read these next
- `AXISOS_MASTER_SUMMARY.md`
- `AXIS_STATE.md`
- `AXISOS_REPO_GUIDE.md`
- `AXISOS_PLAN_VS_CURRENT.md`
- `AXIS_AGENT_RULES.md`
- `AXIS_IDENTITY.md`
