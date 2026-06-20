# AXISOS Repo Guide

_Last reviewed: 2026-06-20_

## 1) What this project is

AXISOS is a **personal operating system dashboard** with a strong sci-fi / HUD cockpit style.

It is currently split into **two main parts**:

1. **Frontend web app**
   - Static app built with:
     - `index.html`
     - `styles.css`
     - plain modular JavaScript files
   - No framework, no bundler, no package manager config in repo.
   - Uses **localStorage first**, with an optional **Supabase REST bridge**.

2. **Bot / automation layer (work-in-progress)**
   - `api/telegram.js` = Vercel-style webhook endpoint for Telegram
   - `gym_bot/` = Python prototype for a more serious gym tracking bot
   - `test_bot_engine.py` = local diagnostic test script for the Python bot

---

## 2) Current frontend architecture

### Entry point
- `index.html`
  - boot overlay
  - persistent top HUD bar
  - module containers
  - loads all module scripts directly in order

### Modules loaded by the frontend
- `core.js` → main dashboard, score, rank, streak, quick actions
- `fitness.js` → water logging, workout split logging, fake EKG, recent lifts
- `sleep.js` → sleep records, quality, weekly chart, simulated iPhone shortcut input
- `music.js` → private music/project browser, procedural synth player
- `library.js` → EPUB/PDF library with IndexedDB storage and inline reader
- `design.js` → creative projects, sprint tasks, design hours
- `nutrition.js` → placeholder only
- `finance.js` → EGX position mockup / simulated market ticks
- `config.js` → commander name, theme, module visibility, Supabase settings, reset
- `supabase.js` → very lightweight REST client + local fallback

### State strategy
- Mostly **browser localStorage**
- Library binaries stored in **IndexedDB** (`AXIS_LIBRARY_DB`)
- Optional cloud mode via Supabase REST if configured

---

## 3) What each module really does today

### CORE
Purpose:
- the home dashboard
- computes a **daily score out of 100**
- shows a **rank system** based on total historical score

Current formula:
- gym: 40
- design: up to 30
- sleep: 10
- water: up to 10
- outside: 5
- tutorial: 5

Important note:
- a lot of the starting data is seeded / hardcoded defaults, not fetched from a backend

### FITNESS
Purpose:
- log workouts and hydration
- display recent workout archive

Current reality:
- split list is hardcoded
- workout logs save to localStorage
- e1RM is calculated
- fake EKG canvas is visual only
- good UI prototype, not yet a full workout database app

### SLEEP
Purpose:
- track sleep hours, wake time, quality
- simulate iPhone shortcuts input

Current reality:
- records are local only
- seeded example week included
- chart is CSS-driven and simple

### MUSIC
Purpose:
- personal/private music project dashboard

Current reality:
- seeded projects + tracks
- playback is mainly a **procedural synth engine**
- uploaded URL metadata is saved, but real uploaded audio playback is not fully wired
- `audioElement` exists in state but is not actually used

### LIBRARY
Purpose:
- personal EPUB/PDF archive
- local reading system

Current reality:
- strongest module conceptually
- stores files in IndexedDB
- keeps metadata in localStorage
- supports inline PDF iframe reader and EPUB.js-based rendering
- metadata extraction is partial/approximate
- total pages are mostly estimated defaults (`150` pdf / `320` epub)

### DESIGN
Purpose:
- project/task/sprint tracking for creative work

Current reality:
- localStorage-based
- seeded project examples (Indomie, Cadbury)
- supports marking tasks complete and logging design hours

### NUTRITION
Purpose:
- reserved slot

Current reality:
- placeholder only

### FINANCE
Purpose:
- personal EGX position tracking

Current reality:
- fully mocked data right now
- no live API integration yet
- simulate button only randomizes price

### CONFIG
Purpose:
- identity, theme, module visibility, Supabase config, reset

Current reality:
- useful control center
- also stores Supabase credentials in browser localStorage

---

## 4) Backend / automation side

### `api/telegram.js`
Intent:
- receive Telegram webhook messages
- parse quick shorthand
- write logs to Supabase
- reply back in Telegram

Current status:
- concept exists, but implementation is incomplete and mismatched with DB schema

### `gym_bot/`
Intent:
- a more advanced gym-tracking assistant using Python
- lifecycle-based training logic
- AI-assisted workout parsing and exercise suggestions

Main files:
- `config.py` → env/config
- `db.py` → SQLite schema + seed data for lifecycles, movements, sets, accessories
- `services.py` → e1RM, lifecycle health, status/history summaries
- `ai_service.py` → Groq/Gemini parsing + exercise suggestions

Current status:
- this subsystem is actually more structured than the Telegram JS webhook
- it compiles, but local test execution currently needs missing dependency installs like `aiosqlite`

---

## 5) Important issues found

## Critical

### A. Hardcoded Supabase secret in frontend
File:
- `supabase.js`

Problem:
- the repo currently exposes a Supabase key directly in browser-side code
- if this is a real secret/service key, it is a **serious security issue**

Action:
- rotate/revoke this key immediately if it is real
- never keep service-role secrets in public frontend code
- browser should only use safe public anon keys, and even then with proper RLS

### B. Schema mismatch in Telegram webhook
File:
- `api/telegram.js`

Problem:
- webhook posts to `/rest/v1/sessions`
- SQL schema defines `fitness_sessions`

Result:
- webhook write likely fails against the provided schema

### C. Security model is too open in SQL
File:
- `axis_supabase_schema.sql`

Problem:
- RLS is disabled on many tables
- storage policies are public and broad

Result:
- okay for fast prototyping, risky for public deployment

---

## Medium issues / implementation gaps

### D. Module visibility checkbox rendering bug
File:
- `config.js`

Problem:
- checkbox HTML uses `checked="${!isHidden}"`
- in HTML, `checked="false"` still counts as checked because the attribute exists

### E. `fetch(..., { timeout: 6000 })` does nothing in browser fetch
File:
- `supabase.js`

### F. Local delete logic is wrong for multi-field matching
File:
- `supabase.js`

Problem:
- `DELETE` in `dbExecuteLocal()` removes items if **any** matchParam field matches, not if **all** match

### G. Music upload is not truly implemented
File:
- `music.js`

Problem:
- tracks are appended to state, but there is no real file upload/storage pipeline yet
- audio URL playback is not fully connected

### H. Library depends on CDN EPUB.js
File:
- `library.js`

Problem:
- loads EPUB.js from CDN
- in restricted previews or offline environments, EPUB rendering may fail

### I. A lot of seeded/demo data is still hardcoded
Files:
- `core.js`, `fitness.js`, `sleep.js`, `music.js`, `design.js`, `finance.js`

Meaning:
- app is more prototype / personal cockpit demo than a fully normalized production app right now

### J. No README / setup docs / package metadata
Problem:
- no clear run instructions in repo
- future chats or collaborators have to inspect files manually

---

## 6) Best description of current maturity

This repo is best described as:

> **A high-style personal dashboard prototype with several strong UX ideas, local-first behavior, and early backend/bot experiments — but not yet a fully unified production system.**

Strongest areas:
- visual identity / HUD concept
- module separation
- local-first personal tooling idea
- library reader concept
- Python gym bot direction

Weakest areas:
- backend consistency
- security
- documentation
- shared data model across frontend / webhook / SQL / Python bot

---

## 7) Best next priorities

### Priority 1 — security cleanup
1. remove hardcoded real secrets from repo
2. rotate exposed keys
3. move sensitive operations server-side

### Priority 2 — define one source of truth for data
Choose one clear path:
- **Path A:** local-first app with optional sync
- **Path B:** real Supabase-backed app

Right now it mixes both and is inconsistent.

### Priority 3 — unify schema naming
Make these match across:
- frontend JS
- `axis_supabase_schema.sql`
- `api/telegram.js`
- Python gym bot

### Priority 4 — documentation
Add:
- README
- architecture overview
- setup instructions
- module roadmap

### Priority 5 — decide scope
The repo currently contains:
- life dashboard
- gym tracker
- reader
- music system
- design sprint manager
- finance tracker
- Telegram bot

That is powerful, but broad. A clear scope decision would help:
- either keep it as a true personal OS hub
- or narrow and stabilize the most important modules first

---

## 8) Suggested mental model for future work

Think of AXISOS as 3 layers:

### Layer 1 — Personal cockpit UI
The dashboard and modules the user interacts with daily.

### Layer 2 — Data / memory layer
LocalStorage, IndexedDB, Supabase tables/storage.

### Layer 3 — Autonomous agents / ingestion
Telegram bot, iPhone shortcuts, finance bot, AI parsers.

The project gets much cleaner if each new feature clearly belongs to one of these layers.

---

## 9) What is missing from this review

I have reviewed the repo itself.

I **have not yet reviewed the old plan/chat plan**, because it was not included in the current chat contents.
Once that old plan is pasted or uploaded, a proper comparison doc should be made:
- original plan
- what got built
- what changed
- what remains

---

## 10) Short summary

AXISOS already has a strong identity and a lot of real work in it.

Right now it is:
- visually strong
- conceptually ambitious
- locally usable in places
- architecturally inconsistent in others

The biggest immediate concern is **security + backend consistency**.
The biggest long-term strength is the **personal OS concept** if the data model gets unified.
