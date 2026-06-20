# AXISOS Chat Handoff

Use this file if a future chat needs instant context.

## Project identity
AXISOS = a personal dashboard / "personal operating system" with a futuristic HUD cockpit style.

## Repo reviewed
- GitHub: `https://github.com/TRVBETA/axisoss`

## What exists now
### Frontend app
Static HTML/CSS/JS app with these modules:
- Core
- Fitness
- Sleep
- Music
- Library
- Design
- Nutrition (placeholder)
- Finance
- Config

### Storage model
- localStorage for most app state
- IndexedDB for library book binaries
- optional Supabase REST bridge

### Automation / bot work
- `api/telegram.js` Vercel webhook prototype
- `gym_bot/` Python gym bot prototype
- `test_bot_engine.py` local test script

## Current reality
This is not just a mockup anymore, but it is also not fully production-ready.
It is a **working personal prototype** with real structure, seeded data, and several unfinished integrations.

## Security/auth foundation added in this chat
New server-auth files now exist:
- `auth.js`
- `api/_axisAuth.js`
- `api/login.js`
- `api/logout.js`
- `api/session.js`
- `api/db-test.js`

Meaning:
- AXIS now has a small PIN login flow scaffolded for Vercel
- browser should no longer hold secret Supabase credentials
- DB connection test now goes through server route `/api/db-test`

## Strong parts
- strong visual/system identity
- modular structure
- local-first behavior
- library reader concept is solid
- Python gym bot direction is promising

## Weak parts
- backend consistency
- Supabase security model
- webhook/schema mismatch
- missing docs
- too much seeded/demo data still hardcoded

## Important warnings
1. `supabase.js` contains a hardcoded Supabase key in frontend code.
   - If real, rotate it immediately.
2. `api/telegram.js` writes to `/rest/v1/sessions`
   - but SQL schema defines `fitness_sessions`
3. SQL disables RLS on many tables
   - okay for prototype, risky for public deployment

## Best next moves
1. security cleanup
2. unify DB/table naming across frontend, SQL, Telegram, Python bot
3. write proper README/setup docs
4. decide whether AXISOS is:
   - mainly local-first with optional sync, or
   - fully Supabase-backed
5. stabilize the highest-value modules first

## High-value module status
### Core
Working local dashboard and scoring system.

### Fitness
Good prototype, local logs, e1RM logic, hydration, fake EKG.

### Sleep
Good local tracker with simulated shortcut input.

### Music
UI is there, but real upload/playback is incomplete.

### Library
One of the best modules conceptually. Uses IndexedDB and inline reading.

### Design
Usable local sprint/task tracker.

### Nutrition
Placeholder.

### Finance
Mocked EGX dashboard, no real API yet.

## Missing item from this chat
The **old plan** was referenced by the user but not provided in this chat yet.
When it is provided, create a comparison doc:
- original plan
- current implementation
- gaps
- next roadmap

## Companion file
Read also:
- `AXISOS_REPO_GUIDE.md`
