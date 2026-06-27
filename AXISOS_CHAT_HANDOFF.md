# AXISOS Chat Handoff

Use this file if a future chat needs fast continuity.

## Identity
AXISOS = a personal operating system / private dashboard with a cleaner minimalist-futurist style direction.

Repo:
- `https://github.com/TRVBETA/axisoss`

## Current architecture
### Frontend
Vanilla app:
- `index.html`
- `styles.css`
- module JS files (`core.js`, `fitness.js`, `sleep.js`, `library.js`, etc.)

### Backend on Vercel
Hobby-plan-safe API count is currently kept under the function limit by merging routes.

Current `/api` should contain only:
- `auth.js`
- `clipboard.js`
- `coredata.js`
- `daily.js`
- `db-test.js`
- `fitness.js`
- `library.js`
- `nutrition.js`
- `sleep.js`
- `telegram.js`

Current `/lib` helpers:
- `axisAuth.js`
- `supabaseServer.js`
- `fitnessServer.js`
- `groqWorkoutParser.js`
- `nutritionServer.js`
- `dailyServer.js`
- `coreDataServer.js`

## Auth
Current login flow:
- identifier + PIN on the login overlay
- server-verified session cookie on Vercel

Related env vars:
- `AXIS_PIN`
- `AXIS_LOGIN_NAME` (optional but supported)
- `SESSION_SECRET`

## Current synced features
Server-backed or partially server-backed:
- core daily telemetry (`daily_debrief_logs`)
- clipboard
- fitness
- sleep webhook/feed
- nutrition logs
- library metadata + file sync
- core balance
- core todos

## Important current tables added beyond original schema
Need these present in Supabase:
- `nutrition_logs`
- `clipboard_items`
- `core_balance`
- `core_todos`

## Current mobile / sync direction
- auto-sync polling exists in the browser
- editing guards were added to reduce input wiping
- mobile layout was partially improved, but still may need cleanup

## Telegram bot status
Current Telegram route:
- `api/telegram.js`

It supports:
- workout shorthand parsing
- `/split`
- optional Groq fallback for messy phrasing

## iPhone shortcut status
Current sleep endpoint:
- `/api/sleep`

Current clipboard shortcut endpoint:
- `/api/clipboard`

## Known caution
The project has gone through many iterative patches. Before adding more big features, verify:
1. latest deployment matches workspace files
2. old `/api` files are deleted from GitHub
3. Supabase SQL incremental tables are present
4. cross-device sync works for the intended module

## Recommended next-chat approach
If another chat continues this:
- inspect current deployed `/api` file list first
- verify latest zip was actually uploaded
- test one module at a time
- avoid stacking multiple sync systems in one pass

## Companion files
Read also:
- `AXISOS_REPO_GUIDE.md`
- `AXISOS_SECURITY_AUTH_PLAN.md`
