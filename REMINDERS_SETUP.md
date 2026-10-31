# AXIS Reminders — full setup

A two-part system: server-side endpoint + dashboard UI for creating reminders,
and a small Windows tray app for receiving them as native toasts.

## What's where

```
api/daily.js                         (modified) reminders namespace extended:
                                       create, ack, pending, wait, sweep, send-telegram
lib/remindersServer.js               (new)      pure logic: sanitize, findDue, recurrence,
                                                  sweep generation, telegram payloads
config.js → REMINDERS card           (UI)       create/list/cancel inside the app
setup.sql                            (schema)   consolidated setup file (old deltas archived)
axis_supabase_delta_reminders_recur_2026-10-31.sql   recurrence + sweep + telegram columns
test_reminders_recur_sweep_telegram.mjs   (new) 16 pure-logic tests
axis_reminder/                       (new)      Windows Python app
  axis_reminder.py                   (new)      main entry, ~200 lines
  requirements.txt                   (new)      4 pip packages
  config.example.json                (new)      copy to config.json
  README.md                          (new)      full install + run guide
  .gitignore                         (new)      ignores config.json + icon.png
```

## How to deploy

1. **Run the SQL delta** against your Supabase project:
   `axis_supabase_delta_reminders_2026-07-24.sql`. Creates the `reminders`
   table with RLS closed off (server-only via service role key).

2. **Deploy the updated zip** to Vercel. The endpoint lives under
   `/api/daily?ns=reminders`. No new function file — it slots into the
   existing `daily.js` to stay under the 12-function Hobby limit.

3. **Create a reminder** inside the app: open the **Config** tab →
   **REMINDERS** card → title + date/time → Set reminder. Pending reminders
   list there too, with a Cancel button (ack). The old standalone
   `reminders.html` page was removed in v5.2.

4. **Install the Windows app** by unzipping
   `axis_reminder_v1_windows.zip` somewhere on your PC, then:
   - `pip install -r requirements.txt`
   - Copy `config.example.json` to `config.json`, fill in server + PIN
   - `python axis_reminder.py`

## Transport

Long-polling, not WebSocket. The desktop app opens one HTTP request at a
time, held by the server up to 5 minutes. When a reminder becomes due,
the server returns it. The app shows the toast, acks the server, and
immediately reopens the request. Idle cost: ~1 HTTP request per 5
minutes per client. Idle bytes: a few KB of headers.

## Tests

```
node test_reminders.mjs
```
Runs 26 assertions: validation rules, long-poll timing, ack flow, since
filter, auth, daily telemetry regression. All pass.

```
node scripts/reminders_ui_debug.mjs
```
Spins up a local server with an in-memory Supabase mock, loads
`reminders.html` in headless chromium, exercises the form, verifies
reminders appear in the list. 0 console errors, 0 network failures.

```
npm test
```
Runs all AXIS test files (8 tests) + the new reminders tests (26
assertions). All pass.

## What was NOT tested

The Python Windows app. I cannot see:
- Whether the tray icon actually appears
- Whether the Windows toast looks right
- Whether the toast sound is on/off
- Whether the autostart shortcut works

You will be the first to see it. If anything looks wrong, tell me.

## Known limitations

- No cancel UI in V1. To cancel a pending reminder, edit the Supabase
  row (`UPDATE reminders SET status='cancelled' WHERE id=...`). The
  desktop app only delivers `status='pending'` reminders.
- No timezone awareness in the UI — date+time picker uses the browser's
  local timezone, converted to ISO UTC on submit.
- No retries on auth failure — if the cookie expires, the app will fail
  with 401s and the user has to restart it. Future: re-auth on 401.
- No delivered-history view. The UI shows only `pending`. The
  `status='delivered'` filter exists in the schema, just not surfaced.

## Recurrence

Reminders can repeat. On `create`, pass `repeat_interval: "daily" | "hourly" | "weekly"`. When a recurring reminder is delivered, the long-poll handler re-inserts the next copy automatically — so "every afternoon" and "before sleep" actually repeat. `daily` is anchored to the calendar day, so a 14:00 reminder stays 14:00 across DST.

## Sweep: afternoon + bedtime reminders

The Vercel cron hits `/api/daily?ns=reminders&action=sweep` once per hour (`0 * * * *` in `vercel.json`). The sweep reads `afternoon_hour` / `bedtime_hour` from `commander_profile` (env vars `AXIS_AFTERNOON_HOUR` / `AXIS_BEDTIME_HOUR` override; defaults 14 / 22) and plants a `payload_kind='tasks'` reminder for the current Cairo-axis day if the hour matches.

The sweep is **idempotent**: each reminder carries a `dedupe_key` (`sweep:afternoon:YYYY-MM-DD`), and a unique partial index rejects duplicates. Re-running the cron is a no-op.

The reminder's body is a placeholder at sweep time. At **delivery** the long-poll handler rewrites it with fresh data — today's unfinished `core_todos` — so the user never sees a snapshot. An `mfp` payload kind is supported the same way (rewrites to "MFP synced today" / "MFP not synced today").

## Telegram delivery

`/api/daily?ns=reminders&action=send-telegram` runs every 30 minutes (`0,30 * * * *`). It sends pending reminders whose `channels` include `telegram` through the existing AXIS bot (`TELEGRAM_BOT_TOKEN` + `AXIS_MASTER_CHAT_ID`), then stamps `telegram_sent_at`. The long-poll stamps `delivered_at` for the toast channel — the two surfaces never race. `channels` is `both` by default, so the sweep reaches both.

## Tests

```
node test_reminders_recur_sweep_telegram.mjs
```
16 assertions: recurrence math, sweep hour gating, dedupe_key shape, telegram payload shape, plus regression checks on `sanitizeReminderCreate` and `findDueReminders`.

```
node test_reminders.mjs
```
26 server tests (create/ack/pending/long-poll/since) + e2e HTTP round-trip against an in-memory Supabase mock. Requires `npm install` for the `ws` package.

```
npm test
```
Runs all AXIS test files.

## What was NOT tested

The Python Windows app. I cannot see:
- Whether the tray icon actually appears in your notification area.
- Whether the toast looks the way you want.
- Whether the toast sound is on/off by default (Windows 10 vs 11 behaviour differs; can be adjusted in Windows Settings > System > Notifications).
- Whether right-click menu feels right.
- Whether the autostart shortcut works.

You will be the first person to see it on a real desktop. If anything looks wrong, tell me and I'll adjust.

## Known limitations

- The sweep and telegram send actions are gated behind `SWEEP_SECRET`. Set it in Vercel env vars or the cron won't fire.
