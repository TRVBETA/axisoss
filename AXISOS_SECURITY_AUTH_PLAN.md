# AXISOS Security & Login Plan

_Last reviewed: 2026-06-20_

## Current direction

AXIS uses a server-side Vercel auth model, not frontend Supabase auth.

### Current login flow
- identifier + PIN entered in browser
- request sent to `api/auth.js`
- Vercel verifies credentials using env vars
- session cookie is created
- frontend then uses the cookie for all authenticated API routes

## Current recommended env vars
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `AXIS_PIN`
- `AXIS_LOGIN_NAME` (optional)
- `SESSION_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `AXIS_MASTER_CHAT_ID`
- `GROQ_API_KEY` (optional)
- `USDA_API_KEY` (optional)
- `SHORTCUT_SHARED_SECRET` (optional)
- `CLIPBOARD_SHARED_SECRET` (optional)

## Current security rules

### Safe in frontend
- app URL
- visual config
- session-driven UI state

### Never in frontend
- Supabase secret/service key
- Telegram bot token
- shared shortcut secrets
- USDA key
- Groq key

## Current route philosophy
Keep `/api` small because of Vercel Hobby limits.
Use `/lib` for helper logic.

## Current `/api` expectation
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

## Current `/lib` expectation
- `axisAuth.js`
- `supabaseServer.js`
- `fitnessServer.js`
- `groqWorkoutParser.js`
- `nutritionServer.js`
- `dailyServer.js`
- `coreDataServer.js`

## Current auth recommendation
If you want stricter personal login, set:
- `AXIS_LOGIN_NAME`
- `AXIS_PIN`

If you only want PIN, leave `AXIS_LOGIN_NAME` empty.

## Shortcut protection
If you want mobile shortcuts protected, use:
- `SHORTCUT_SHARED_SECRET`
- `CLIPBOARD_SHARED_SECRET`

These can be sent in JSON body or bearer/header depending on endpoint usage.

## Best next security improvements later
1. shorter-lived sessions with refresh flow
2. optional device-specific remember behavior
3. move more local remnants to server-backed models
4. optional Supabase Realtime instead of naive polling for sync-sensitive modules
