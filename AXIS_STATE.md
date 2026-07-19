# AXIS State

Last updated: 2026-07-20

## Current top priorities
1. Build reminder / enforcement system
2. Keep Core / Tasks / Fitness / Nutrition stable
3. Finish popup/modal hardening
4. Preserve same-brain cross-device sync
5. Avoid UI drift and hidden regressions

## Current high-priority modules
- Core
- Fitness
- Nutrition
- Sleep sync
- Library
- Telegram

## Current repo truths
- Repo: `/home/user/repo_latest`
- Main frontend shell: `index.html`, `styles.css`, `core.js`
- Main scoring + backend logic: `lib/axisScoreV4.js`, `lib/coreDataServer.js`, `lib/dailyServer.js`
- Library fix: `library.js` + `vendor/epub.min.js`
- SQL delta to apply if needed: `axis_supabase_delta_v4_library_2026-07-19.sql`

## Important current behavior
- task streak momentum comes from `core_task_events`
- rituals still exist but do not own the main momentum block anymore
- nutrition defaults to cooked unless explicitly raw
- Telegram bot is still the single unified bot
- sleep sync still runs in background even though the old sleep page shell is removed

## Known issues to watch
- modal shell alignment / scroll with long content may still need one more pass
- repeated edits have happened; future changes should be smaller and audited
- some lower-priority modules still need visual consistency passes

## What good looks like now
- stable Core
- working library open/upload
- accurate V4 score updates
- task streaks visible and believable
- Telegram reminders/logging trusted
- no random rerender fights while typing
