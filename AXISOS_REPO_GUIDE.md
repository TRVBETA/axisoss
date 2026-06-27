# AXISOS Repo Guide

_Last reviewed: 2026-06-20_

## 1) What AXISOS is now

AXISOS is a personal operating system dashboard running as a vanilla web app on Vercel with a Supabase-backed server layer.

It is no longer just a static mockup. It now includes:
- frontend modules
- server API routes
- Telegram workout logging
- sleep shortcut webhook support
- nutrition parsing/logging
- clipboard sync
- library sync
- core dashboard balance and todo data

---

## 2) High-level structure

### Frontend
Main files:
- `index.html`
- `styles.css`
- `core.js`
- `fitness.js`
- `sleep.js`
- `music.js`
- `library.js`
- `design.js`
- `nutrition.js`
- `finance.js`
- `config.js`
- `auth.js`
- `supabase.js`

### Backend
Vercel API files currently expected in `/api`:
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

### Shared server helpers in `/lib`
- `axisAuth.js`
- `supabaseServer.js`
- `fitnessServer.js`
- `groqWorkoutParser.js`
- `nutritionServer.js`
- `dailyServer.js`
- `coreDataServer.js`

---

## 3) Current data model split

### Server-backed now
- daily score inputs (`daily_debrief_logs`)
- fitness sessions/sets
- sleep logs
- nutrition logs
- clipboard items
- library metadata + files
- core balance
- core todos

### Still mostly local or incomplete
- some theme/UI preferences
- music system
- finance module
- design project storage (still mainly local)

---

## 4) Main current modules

### CORE
Current role:
- daily score
- status strip
- streak shell
- quick clipboard
- quick daily actions
- editable balance
- todo list

Backend dependencies:
- `api/daily.js`
- `api/clipboard.js`
- `api/coredata.js`

### FITNESS
Current role:
- workout log
- main lifts tracker
- history chart
- exercise memory
- historical import

Backend dependencies:
- `api/fitness.js`
- `api/telegram.js`
- `lib/fitnessServer.js`
- optional Groq fallback parser

### SLEEP
Current role:
- sleep dashboard
- weekly trend
- manual webhook simulation
- iPhone Shortcut webhook target

Backend dependency:
- `api/sleep.js`

### NUTRITION
Current role:
- food logging
- hydration display
- macro summary

Backend dependencies:
- `api/nutrition.js`
- `lib/nutritionServer.js`
- optional Groq fallback
- optional USDA API fallback

### LIBRARY
Current role:
- EPUB/PDF upload
- popup reading modal
- synced metadata
- synced storage-backed files

Backend dependency:
- `api/library.js`

### DESIGN
Current role:
- still mostly local sprint/project tracker
- design-hours UI exists
- not fully server-mode yet

### MUSIC
Current role:
- still mostly prototype / local UI

### FINANCE
Current role:
- still mocked

---

## 5) Current auth/security model

AXIS now uses:
- server-side auth check
- identifier + PIN login flow
- cookie-based session on Vercel
- secret keys kept out of frontend

Important env vars:
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `AXIS_PIN`
- `AXIS_LOGIN_NAME` (optional)
- `SESSION_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `AXIS_MASTER_CHAT_ID`
- `GROQ_API_KEY` (optional parser fallback)
- `USDA_API_KEY` (nutrition fallback)
- `SHORTCUT_SHARED_SECRET` (optional iPhone shortcut protection)
- `CLIPBOARD_SHARED_SECRET` (optional clipboard shortcut protection)

---

## 6) Important SQL additions required

Beyond the older schema, the current app expects these tables too:
- `nutrition_logs`
- `clipboard_items`
- `core_balance`
- `core_todos`

If these are missing, newer features will break even if deploy succeeds.

---

## 7) Current deployment rule

Because Vercel Hobby has a function-count limit, avoid scattering many tiny endpoints.

That is why routes were merged into a smaller `/api` surface and helpers were moved into `/lib`.

If old `/api` files remain in GitHub, deployment may still fail or use stale structure.

---

## 8) Current main risk areas

1. frontend still has many module-level rerenders because it is plain JS
2. multiple modules evolved from local-first to server-sync incrementally
3. design/music are not yet rebuilt around the same server-first model
4. docs may fall behind implementation quickly unless updated with each major pass

---

## 9) Practical truth

AXISOS is currently in an in-between state:
- more capable than the original prototype
- not yet a clean, finished production system
- increasingly server-backed
- still carrying some legacy local-first behavior

That means future work should prioritize:
1. stability
2. sync consistency
3. mobile polish
4. reducing UI noise
5. only then adding more features

---

## 10) Recommended future rule

When changing AXIS:
- do one backend model at a time
- do one module at a time
- verify typing/editing does not get interrupted by sync
- verify desktop + phone behavior before moving on
