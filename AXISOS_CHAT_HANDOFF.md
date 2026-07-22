# AXISOS Chat Handoff // V5

Last updated: 2026-07-22

Use this file first if a future chat loses context.

## AXIS PROTOCOL // non-negotiable rules

When the user says "this is protocol", save it here. These rules are binding for every future change.

1. **Streaks always visible as numbers.** No hiding, no "at risk only" logic, no shrinking. Accountability means the number faces you, even when it hurts. Guilt is a feature.
2. **No sounds, ever.** No notification beeps, no task-complete chimes, no audio of any kind. Sanctuary is silent.
3. **No notification badges, ever.** No "1" on a tab, no pulsing, no confirmations. Data moves, the UI doesn't perform.
4. **The score stays at full visual weight.** Don't reduce. The day's verdict, loud.
5. **Time is the second-loudest thing, score is the loudest.** Order is intentional.
6. **Login is a threshold, not a form.** One field. Type, return, in. No "submit" button, no panel.
7. **Empty states are calm, not apologetic.** "Nothing here yet." No "Add your first" CTA begging.
8. **Tasks are the main hero of the day.** Not the only thing, but the central thing you land on.
9. **The design language we have is the design language we keep.** Dune/void palette, 36px hero cards, 18px flat cards, mono overlines, 6.5s halo loop, rounded-pill buttons. Locked. Don't redesign, don't add new colors, don't add new type families.
10. **Build the smallest slice that solves the actual ask.** No scope creep. No "while I'm in there" cleanups unless asked.
11. **Superseded by PROTOCOL 18** (left-edge slider for the today field is the active pattern on the left edge).
12. **Musical theme is on the future list.** Don't lose it.
13. **Cross-device first.** Every new feature, layout, interaction, and component must work on both phone and desktop. If a design decision helps one and hurts the other, redesign. Test ≤520px and ≥901px before shipping. No exceptions.
14. **No CTA buttons.** No "Add your first task", "Try it now", "Get started". Empty states don't beg. The user knows what to do; if they don't, they'll learn from the labels. No CTAs.
15. **Core score and Core hero layout: do not touch.** The current visual weight of the score, the layout of the hero (score / primary / momentum), the typography — all locked. Reinforced from PROTOCOL 4.
16. **Tasks get more visual weight on Core, not less.** Everything else stays. Tasks card grows, surrounding whitespace doesn't.
17. **The design language we have is the design language we keep.** Reinforced from PROTOCOL 9.
18. **Left-edge small slider for "today in one line".** Retires nothing about the 9-module nav. The 9 modules stay in the top nav (desktop) and the bottom-sheet hamburger (phone). Cross-device (PROTOCOL 13). The slider holds the field only.
19. **Hamburger is the three-line menu icon in a UI.** Not relevant to AXIS anymore — left-edge slider replaces it for the today field specifically; the hamburger is still the phone nav.
20. **No previews or demo HTML files.** The user cannot use previews in this environment. The only `.html` files in the repo are `index.html` and the archived `archive/standalone_preview.html`. Never create `*_preview.html`, `*_demo.html`, or any visual-staging file. Ship the real files only.

## Current repo

- Working repo: `/home/user/repo_latest`
- Latest SQL delta: `/home/user/repo_latest/axis_supabase_delta_v4_library_2026-07-19.sql`
- Latest zip should be regenerated from the current repo before handoff if new changes were made after the last export.

## Product identity

AXIS / AXISOS is a private personal operating system dashboard.

Current design intent:

- true-black base
- floating capsule top shell
- premium spacing
- low text noise
- restrained dune/gold accent
- strong focus on Core / Tasks / Fitness / Nutrition

## What is real and working now

### Server-backed areas

- auth
- daily telemetry / V4 scoring
- core todos + task events
- clipboard
- fitness logging
- nutrition logging
- sleep logging
- library metadata + file sync
- Telegram bot route

### V4 scoring state

- V4 task model is integrated into backend and Core UI
- sleep / fitness / nutrition feed Core
- task momentum is now derived from `core_task_events`
- ritual streaks still exist, but main momentum is task-based

### Telegram state

- one real bot route: `api/telegram.js`
- supports workout / nutrition / task matching / voice transcription path
- GET probe now reports whether deploy is online / degraded / unconfigured
- true human-side live verification still requires the user to message the bot after deploy

### Library state

- rebuilt to avoid blocked CDN dependencies
- EPUB engine is bundled locally in `vendor/epub.min.js`
- PDF uses native in-app iframe/blob path
- local-first with server fallback for missing binaries

## Current known issues / caution

- modal shell behavior was hardened on 2026-07-20: the two Core modals (clipboard, task capture) now mount into a `modals.js` portal at document body level instead of living inside `module-core`, so auto-sync ticks and Core re-renders no longer destroy their DOM mid-typing. Focus trap, scroll lock, and Escape close are also handled there. The Core still owns state and form HTML builders.
- sleep page was rewritten clean on 2026-07-20 as a small read-only status surface for the iPhone Shortcut wake/sleep handoff. The page shows current state (AWAKE / SLEEPING / UNKNOWN), last wake time, last sleep time, last computed sleep duration, and the webhook URL + payload examples. The shortcut posts `{"event":"wake"}` or `{"event":"sleep"}` to `/api/sleep`; the server computes the gap on the next wake and writes it to `sleep_circadian_logs` so V4 scoring still receives sleep data.
- quiet auto-logout added on 2026-07-20 via `idle.js`. After 4 hours of no mouse / keyboard / touch / focus activity, AXIS signs itself out the next time the tab is focused (or every 60s in the background). No modal, no scary alert. The 30-day server cookie still lasts; this is UX enforcement on top.
- the in-browser `notification_rules` system (client + server + schema) was removed on 2026-07-20. If you have an old DB, run `axis_supabase_delta_v5_drop_notifications_2026-07-20.sql` to drop the table.
- the `standalone_preview.html` early-prototype artifact was moved to `archive/standalone_preview.html` on 2026-07-20. It is no longer the active build.
- Core page order was reshuffled on 2026-07-20: hero (score / primary / momentum) → tasks (full width, accent-bordered) → weekly review + clipboard row → destiny (smaller, flat).

## User priorities right now

1. reminders / accountability pressure
2. tasks
3. fitness
4. nutrition
5. stable clean UX without drift

## Next recommended feature

Build reminder system before any desktop app.
Best delivery order:

1. server reminder engine
2. Telegram reminders
3. optional browser push
4. optional tiny desktop notifier later

## Read these next

- `AXISOS_MASTER_SUMMARY.md`
- `AXIS_STATE.md`
- `AXISOS_REPO_GUIDE.md`
- `AXISOS_PLAN_VS_CURRENT.md`
- `AXIS_AGENT_RULES.md`
- `AXIS_IDENTITY.md`
