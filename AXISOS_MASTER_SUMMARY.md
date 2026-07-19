# AXISOS Master Summary

Last updated: 2026-07-20

## Current goal
AXISOS should function as a private personal operating system dashboard with:
- severe clean black-capsule UI
- real server-backed behavior
- same-brain sync across devices
- strong task enforcement
- strong fitness + nutrition integration
- unified Telegram support
- V4 scoring wired into Core

## Current implementation summary
### Core / V4
Implemented:
- V4 scoring backend (`lib/axisScoreV4.js`)
- V4 daily telemetry integration (`lib/dailyServer.js`)
- task model fields in `core_todos`
- task event history in `core_task_events`
- Core UI uses V4 day score / primary / destiny / tasks
- task streak momentum now derives from actual completion history

### Telegram
Single real bot route:
- `api/telegram.js`

Supports:
- workout logging
- nutrition logging
- task matching / completion
- optional voice transcription
- deploy health probe on GET

### Nutrition
Implemented:
- cooked default unless explicitly raw
- white rice alias fix
- row macros shown
- server-backed logs
- V4 nutrition score recalculation hooks

### Fitness
Implemented:
- server-backed sessions / sets
- V4 fitness score recalculation hooks
- workout logging via UI and Telegram

### Sleep
Implemented:
- server-backed sleep logs
- V4 sleep score integration
- sleep module file still loaded for background sync support

### Library
Implemented:
- local-first upload
- server file sync
- PDF open path
- bundled local EPUB engine (`vendor/epub.min.js`)
- removed critical dependency on blocked viewer CDNs

## Current known weak spots
- popup shell behavior still needs one more focused pass if long content affects placement/scroll
- lower-priority modules are not as polished as Core
- deploy truth still matters more than local workspace truth; after changes, user should deploy and verify

## Current important files
### Frontend
- `index.html`
- `styles.css`
- `core.js`
- `fitness.js`
- `nutrition.js`
- `sleep.js`
- `library.js`
- `config.js`

### Backend / server
- `api/coredata.js`
- `api/daily.js`
- `api/fitness.js`
- `api/nutrition.js`
- `api/sleep.js`
- `api/library.js`
- `api/telegram.js`

### Core logic
- `lib/axisScoreV4.js`
- `lib/coreDataServer.js`
- `lib/dailyServer.js`
- `lib/fitnessServer.js`
- `lib/nutritionServer.js`

### SQL
- `axis_supabase_schema.sql`
- `axis_supabase_delta_v4_library_2026-07-19.sql`

## Current recommended next build direction
Do not jump into a full desktop app yet.
If the real need is reminders / nudges / enforcement, build:
1. reminder engine
2. Telegram delivery
3. optional browser push
4. only later a tiny desktop notifier if still needed

## Current reminder-system philosophy
The problem is delivery and pressure, not packaging.
AXIS should remind through the channel most likely to force action.
Right now that is probably Telegram first.
