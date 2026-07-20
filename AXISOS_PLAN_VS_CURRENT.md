# AXISOS Plan vs Current Repo

Last reviewed: 2026-07-20

## Summary

The repo is still clearly AXIS, but it is now much further along in real backend behavior, Telegram integration, scoring logic, and library sync.

## What matches the intended product

- private personal operating system concept
- modular file layout
- floating shell / dashboard model
- strong single-user accountability focus
- core / fitness / nutrition as priority pillars
- cross-device continuity ambition

## What evolved beyond the older prototype

- server-side auth on Vercel
- unified Telegram bot route
- sleep webhook route
- nutrition parser + scoring hooks
- library metadata + file sync
- V4 score logic integrated into Core/backend
- task event history now used for streak momentum

## What is now true

- AXIS is no longer just a local dashboard prototype
- Core behavior depends on backend truth
- score, nutrition, fitness, sleep, and tasks are interlinked
- library works through local-first + server-backed fallback

## What still needs work compared to the ideal

- reminder / enforcement engine is still not built (V5 slice was started then reverted; data + Telegram + UI are all designed but not committed)
- auto-sync loop hits 7 routes every 5s — should become a single delta endpoint
- lower-priority modules (music, design, finance) still need consistency cleanup
- deploy verification still matters after every serious change

## 2026-07-20 cleanup pass

- Modal shell hardened: clipboard + task modals now mount through `modals.js` portal at body level with focus trap + scroll lock + Escape close.
- Core page order reshuffled: hero → tasks (full width, accent-bordered) → weekly review + clipboard row → destiny (smaller, flat at the bottom).
- AXIS logo gets a subtle warm halo + wordmark text-glow on a 6.5s loop, both disabled under `prefers-reduced-motion`.
- In-browser notification system removed end to end: client, route, server helper, schema table. Destructive SQL delta for existing DBs.
- `standalone_preview.html` (3k-line prototype artifact) moved to `archive/`.
- Sleep page rewritten clean as a small status surface for the iPhone Shortcut wake/sleep handoff. Old `quality stars`, weekly chart, and simulate-webhook form are gone. New `api/sleep.js` accepts `{"event":"wake"}` / `{"event":"sleep"}` from the shortcut, computes the gap on wake, and writes it to `sleep_circadian_logs` so V4 scoring still works. Legacy `{hours, wakeTime, quality}` payload still accepted.
- Quiet 4-hour auto-logout added via `idle.js`. Listens for mouse / keyboard / touch / focus activity, logs out next time the tab is focused after the threshold. No modal.

## Best interpretation now

AXIS is already a real evolving product. The next smart move is not more random surface area. It is building the reminder/enforcement system on top of the current stable Core/Telegram base.
