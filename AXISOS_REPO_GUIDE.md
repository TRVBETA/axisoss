# AXISOS Repo Guide

_Last reviewed: 2026-06-20_

## 1) Project summary

AXISOS is a vanilla HTML/CSS/JS personal operating system dashboard using:
- Vercel for hosting + API routes
- Supabase for database and storage
- Telegram webhook for workout logging
- iPhone Shortcut webhook support for sleep and clipboard

It is no longer just a local prototype. Several modules now depend on server-backed sync.

---

## 2) Frontend files

Main frontend files:
- `index.html`
- `styles.css`
- `auth.js`
- `supabase.js`
- `core.js`
- `fitness.js`
- `sleep.js`
- `music.js`
- `library.js`
- `design.js`
- `nutrition.js`
- `finance.js`
- `config.js`

Design direction now:
- cleaner / minimal
- warmer dune-gold accent
- less neon HUD, more calm premium software feeling

---

## 3) Backend files

### `/api`
Should currently contain only:
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

### `/lib`
Server helpers:
- `axisAuth.js`
- `supabaseServer.js`
- `fitnessServer.js`
- `groqWorkoutParser.js`
- `nutritionServer.js`
- `dailyServer.js`
- `coreDataServer.js`

---

## 4) Current synced modules

### CORE
Server-backed parts:
- daily telemetry actions
- clipboard
- balance
- todos

### FITNESS
Server-backed:
- sessions
- sets
- main-lift reconstruction
- Telegram logging support

### SLEEP
Server-backed:
- sleep logs
- iPhone Shortcut webhook target

### NUTRITION
Server-backed:
- food logging
- macro totals
- optional Groq fallback
- optional USDA fallback

### LIBRARY
Server-backed now:
- metadata
- file upload path
- file retrieval path
- progress sync

---

## 5) Important SQL expectations

Current app expects these server tables at minimum:
- original AXIS tables from schema
- `nutrition_logs`
- `clipboard_items`
- `core_balance`
- `core_todos`

If these are missing, related features will break.

---

## 6) Current auth/security model

Current auth flow:
- identifier + PIN login in browser
- Vercel verifies credentials
- cookie session protects `/api`

Important env vars:
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

---

## 7) Current reality

AXIS is now in a transitional state:
- much more capable than the early prototype
- more server-backed than before
- still sensitive to rerender/sync issues because it is plain JS and was evolved incrementally

That means stability matters more than adding many new systems at once.

---

## 8) Recommended future rule

When continuing development:
1. fix one module fully
2. verify phone + desktop behavior
3. only then move to the next module
4. avoid mixing local state and server truth for the same feature unless explicitly intentional
