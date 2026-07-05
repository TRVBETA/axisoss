# AXISOS Chat Handoff

Use this if a future chat needs quick recovery.

## Current identity
AXISOS = a private personal operating system dashboard.

Current design direction:
- cleaner
- more minimal
- Apple-software-like clarity
- still slightly dune-futurist through warm sand/gold accenting

Repo:
- `https://github.com/TRVBETA/axisoss`

## Current backend shape
Vercel Hobby-safe merged API structure.

### `/api` should contain only
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

### `/lib` should contain
- `axisAuth.js`
- `supabaseServer.js`
- `fitnessServer.js`
- `groqWorkoutParser.js`
- `nutritionServer.js`
- `dailyServer.js`
- `coreDataServer.js`

## Current synced/server-backed areas
- auth
- daily telemetry / score inputs
- fitness
- sleep
- nutrition
- clipboard
- library metadata + file sync
- core balance
- core todos

## Important SQL additions beyond older schema
These tables must exist:
- `nutrition_logs`
- `clipboard_items`
- `core_balance`
- `core_todos`

## Current known fragile areas
- plain JS rerender behavior can still cause UX issues if not guarded
- mobile layout improved but still needs careful tuning page by page
- design/music are not fully server-first yet

## Current user priorities
1. make sync reliable
2. reduce UI noise
3. keep mobile Safari usable
4. make everything feel more minimal / clean
5. keep clipboard useful for phone ↔ PC text transfer

## Important workflow rule
Before adding more major features:
- confirm latest workspace files were really uploaded to GitHub
- confirm old `/api` files were deleted
- confirm Supabase incremental SQL was run
- test desktop + phone on the exact deployed version

## Read these first in any future chat
- `AXIS_IDENTITY.md`
- `AXIS_STATE.md`
- `AXIS_AGENT_RULES.md`
- `AXISOS_MASTER_SUMMARY.md`
