# AXISOS Plan vs Current Repo

_Last reviewed: 2026-06-20_

This compares the old AXIS master plan against the current GitHub repo.

---

## Overall verdict

The repo follows the **same overall vision** as the old plan very closely:
- personal OS / fortress concept
- HUD cockpit shell
- modular file structure
- local-first + Supabase option
- same core modules
- same aesthetic direction

So the project did **not drift away** from the plan.

What changed is mostly this:
- the current repo is a **prototype implementation** of the plan
- some features are real and usable
- some are mocked / seeded
- some backend/security decisions were taken in a quick prototype way and now need cleanup

---

## 1) Architecture match

### Old plan
Wanted:
- `index.html`
- one JS file per module
- `supabase.js`
- `config.js`
- `styles.css`
- page-swap module model
- persistent HUD bar

### Current repo
Status: **matched almost exactly**

Current files:
- `index.html`
- `core.js`
- `supabase.js`
- `fitness.js`
- `sleep.js`
- `music.js`
- `library.js`
- `design.js`
- `nutrition.js`
- `finance.js`
- `config.js`
- `styles.css`

Verdict:
- file structure is basically a direct execution of the original plan

---

## 2) Visual direction

### Old plan
Wanted:
- dark navy / near-black
- violet accent
- technical minimal HUD
- all caps monospace headers
- clean sans body text
- less gaming, more fighter jet cockpit

### Current repo
Status: **matched strongly**

Observed:
- dark HUD shell
- violet/cyan/green accent system
- cockpit cards, glow, telemetry language
- strong Iron Man / tactical UI feel

Difference:
- current version is a little more dramatic / theatrical than the plan’s “slightly more minimal” target
- but still clearly aligned with the intended style

Verdict:
- very successful translation of the original visual direction

---

## 3) Navigation model

### Old plan
Wanted:
- persistent top HUD bar
- modules swap below
- focused full-page module layout

### Current repo
Status: **matched**

Observed:
- persistent header bar
- nav tabs for all modules
- `switchModule()` activates one module page at a time

Verdict:
- implemented as planned

---

## 4) Core module

### Old plan
Wanted:
- name
- rank
- date/time
- daily score in center
- status strip
- streak info
- “line of truth”

### Current repo
Status: **implemented well**

Observed:
- commander name
- revolution ranks
- clock/date
- big score display
- telemetry status strip
- streak card
- “last logged” line

Difference:
- rank names are no longer TBD; they were filled in with revolution-style placeholders
- total score / streak values are seeded defaults right now

Verdict:
- one of the most complete implementations versus plan

---

## 5) Fitness module

### Old plan
Wanted:
- EKG display
- hydration cartridge system
- workout logging
- recent archives
- real Obsidian split

### Current repo
Status: **implemented as a strong prototype**

Observed:
- fake animated EKG canvas exists
- hydration 600ml tap system exists
- split logging form exists
- recent archive list exists
- split exercise lists closely match the plan

Difference:
- legs is still simple and underdeveloped
- logs are mostly localStorage, not a full synced backend pipeline yet

Verdict:
- very faithful to the plan, but backend depth still pending

---

## 6) Sleep module

### Old plan
Wanted:
- hours slept
- wake time
- manual quality
- weekly trend
- iPhone shortcut pipeline later

### Current repo
Status: **implemented as local simulation**

Observed:
- hours, wake time, quality, weekly chart are there
- shortcut input is simulated inside UI

Difference:
- actual iPhone Shortcuts POST bridge is not yet implemented end-to-end

Verdict:
- frontend is on-plan; automation bridge still partial

---

## 7) Music module

### Old plan
Wanted:
- large centered cover
- playback controls
- upload song + cover + project
- organize by project/album
- private Spotify feel

### Current repo
Status: **partially implemented**

Observed:
- dominant centered cover art
- play/pause/next/prev/volume controls
- project-based organization
- upload form exists

Difference:
- actual real music storage/upload flow is not complete
- playback is mostly procedural synth behavior, not a finished private Spotify system

Verdict:
- UI concept is built; real media pipeline is not finished yet

---

## 8) Library module

### Old plan
Wanted:
- book list
- EPUB upload
- inline reading
- progress tracking
- responsive desktop/iPhone
- carry-forward

### Current repo
Status: **very strong implementation**

Observed:
- upload exists
- metadata extraction attempts exist
- IndexedDB storage exists
- EPUB and PDF inline reading exist
- page/progress logic exists
- carry-forward exists

Difference:
- uses local IndexedDB instead of full Supabase storage flow by default
- EPUB.js is pulled from CDN
- page totals are approximate defaults in many cases

Verdict:
- one of the most developed modules in the current repo

---

## 9) Design module

### Old plan
Wanted:
- active projects
- task list + progress bars
- carry-forward tasks
- hours today + weekly total
- Indomie active, Cadbury done

### Current repo
Status: **matched closely**

Observed:
- project cards
- progress bars
- carry-forward tasks
- design hours today and weekly
- same project examples

Verdict:
- highly faithful to plan

---

## 10) Nutrition module

### Old plan
Wanted:
- placeholder only for now

### Current repo
Status: **matched exactly**

Verdict:
- implemented exactly as placeholder architecture

---

## 11) Finance module

### Old plan
Wanted:
- phase 3
- EGX position
- P&L
- Telegram finance bot later

### Current repo
Status: **prototype placeholder / mock**

Observed:
- position card exists
- P&L display exists
- tick simulation exists
- phase 3 bot note exists

Difference:
- still mocked, no real live finance bridge yet

Verdict:
- matches the roadmap stage described in the plan

---

## 12) Config / HUD settings

### Old plan
Wanted:
- editable name
- theme selector
- Supabase connection status
- module toggle
- animation level

### Current repo
Status: **mostly implemented**

Observed:
- commander name editor
- theme selector
- module show/hide
- Supabase URL/key inputs
- reset button

Difference:
- animation level control is not really implemented
- config currently asks the user to paste Supabase credentials, which is bad for the long-term UX and security model

Verdict:
- functionally close, but needs redesign for production use

---

## 13) Data entry methods

### Old plan
Wanted:
- Telegram for gym
- iPhone Shortcuts for sleep
- taps inside AXIS
- manual entries in AXIS
- Telegram EOD

### Current repo
Status: **mixed**

Implemented now:
- taps inside AXIS: yes
- manual input in AXIS: yes
- local simulation: yes

Partially implemented:
- Telegram bridge: prototype exists in `api/telegram.js`
- iPhone shortcut flow: concept reflected in `sleep.js`, but end-to-end backend path not complete
- EOD/debrief logic: lightly referenced in Telegram code, not fully realized

Verdict:
- data-entry architecture exists in concept, but only part of it is production-ready

---

## 14) Scoring system

### Old plan
Wanted:
- daily max 100
- gym 40
- design 30
- sleep 10
- water 10
- outside 5
- tutorial 5

### Current repo
Status: **implemented exactly / nearly exactly**

Verdict:
- direct translation from the old plan into code

---

## 15) Streak logic

### Old plan
Wanted:
- visible current streak
- longest streak
- visual degradation when missing days

### Current repo
Status: **partially implemented**

Observed:
- current streak, longest streak, last break are displayed

Missing:
- the visual degradation system for missed days is not truly implemented
- streak calculations look mostly seeded/static right now, not deeply automated

Verdict:
- visible shell exists, deeper behavior still pending

---

## 16) Rank system

### Old plan
Wanted:
- 7 levels
- revolution theme
- long-term earned progression

### Current repo
Status: **implemented with placeholder names**

Observed:
- 7 defined ranks
- الثورة framing remains
- point thresholds exist

Difference:
- looks like placeholder rank naming was resolved into a first pass, but may still not be final

Verdict:
- implemented, but probably still open to refinement

---

## 17) Supabase / backend plan

### Old plan
Wanted:
- Supabase database + storage
- Vercel hosting
- simple deployment flow

### Current repo
Status: **partially implemented but insecure/inconsistent**

Observed:
- Supabase client helper exists
- SQL schema exists
- Vercel API endpoint exists

Problems:
- exposed secret in frontend code
- schema naming mismatch (`sessions` vs `fitness_sessions`)
- RLS disabled widely
- frontend still expects manual credential entry in config

Verdict:
- backend was started fast for prototyping, but now needs a serious cleanup pass

---

## 18) Biggest plan-to-repo gaps

### Gap A — security model
The old plan assumed a simple, smooth personal deployment.
The repo currently uses a risky prototype setup:
- exposed key in frontend
- no clean auth story
- overly open DB policies

### Gap B — real sync layer
Many modules still work mainly in localStorage/demo mode instead of a truly unified Supabase-backed personal OS.

### Gap C — login / identity flow
Old plan focused on one-person daily use.
Current repo does not yet provide a clean “enter once and you’re in” personal login flow.

### Gap D — documentation
Old plan is clear conceptually.
Repo still lacks formal README/setup instructions for future continuity.

---

## 19) Best interpretation

The current repo is **not off-track**.
It is actually a very faithful first implementation of the old AXIS master plan.

The main thing that happened is this:
- the **frontend vision landed well**
- the **prototype logic landed well in several modules**
- the **production data/security/auth layer is still immature**

So the repo is best seen as:

> **Phase 1 completed visually and structurally. Phase 2 now needs security, auth, backend unification, and real sync.**

---

## 20) Best next step after this comparison

If continuing the project, the smartest next work is:

1. remove exposed secret keys
2. replace manual Supabase credential entry with deployment env vars
3. add a simple personal login gate (PIN or email magic link)
4. unify DB schema names across frontend / SQL / webhook / bot
5. decide which modules remain local-first and which become real synced modules

---

## Final summary

### What matched well
- shell structure
- file layout
- visual language
- core/fitness/sleep/design concepts
- library concept
- scoring system
- multi-module personal OS identity

### What is still incomplete
- secure auth
- backend consistency
- real Telegram + iPhone shortcut pipelines
- production-grade Supabase usage
- documentation

### Bottom line
The GitHub version is a **real descendant of the old map**, not a different project.
It mostly needs **hardening and unification**, not a redesign from scratch.
