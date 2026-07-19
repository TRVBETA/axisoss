# AXISOS Repo Guide

Last reviewed: 2026-07-20

## 1) Project summary

AXISOS is a vanilla HTML/CSS/JS personal operating system dashboard using:

- Vercel for hosting + API routes
- Supabase for database and storage
- Telegram webhook for logging and capture
- iPhone Shortcut webhook support for sleep / quick sync

It is no longer a local-only prototype.

---

## 2) Frontend files

Main frontend files:

- `index.html`
- `styles.css`
- `auth.js`
- `supabase.js`
- `core.js`
- `fitness.js`
- `sleep.js` (background sync support still relevant)
- `music.js`
- `library.js`
- `design.js`
- `nutrition.js`
- `finance.js`
- `config.js`

Page shells currently visible in `index.html`:

- core
- fitness
- music
- library
- design
- nutrition
- finance
- config

Old page shells removed from main app shell:

- journal
- notifications
- sleep

---

## 3) Backend files

### `/api`

Current important routes:

- `auth.js`
- `clipboard.js`
- `coredata.js`
- `daily.js`
- `db-test.js`
- `fitness.js`
- `journal.js`
- `library.js`
- `notifications.js`
- `nutrition.js`
- `sleep.js`
- `telegram.js`

Note: some routes still exist even if their page shells were removed.

### `/lib`

Important helpers:

- `axisAuth.js`
- `axisScoreV4.js`
- `supabaseServer.js`
- `fitnessServer.js`
- `groqWorkoutParser.js`
- `nutritionServer.js`
- `dailyServer.js`
- `coreDataServer.js`
- `journalServer.js`
- `notificationServer.js`

---

## 4) Current synced modules

### Core

- V4 daily telemetry
- todos
- task history
- streak momentum
- clipboard

### Fitness

- sessions
- sets
- V4 fitness score hooks

### Nutrition

- parser
- food logs
- V4 nutrition score hooks

### Sleep

- logs
- V4 sleep score hooks

### Library

- metadata
- file upload path
- file retrieval path
- progress sync
- local bundled EPUB engine

### Telegram

- unified bot route
- workout / nutrition / task matching
- optional voice transcription path
- deploy health probe via GET

---

## 5) SQL expectations

Use:

- `axis_supabase_schema.sql` for full schema
- `axis_supabase_delta_v4_library_2026-07-19.sql` for rerunnable delta / patch application

---

## 6) Current reality

AXIS is in an advanced iterative state:

- much more server-backed than the early prototype
- stronger Core / scoring / Telegram / library behavior than before
- still sensitive to popup/rerender UX issues because it evolved incrementally

Future work should stay narrow and auditable.
