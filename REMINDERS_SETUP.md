# AXIS Reminders — full setup

A two-part system: server-side endpoint + dashboard UI for creating reminders,
and a small Windows tray app for receiving them as native toasts.

## What's where

```
api/daily.js                         (modified) reminders namespace added
lib/remindersServer.js               (new)      pure logic, testable
reminders.html                       (new)      dashboard UI for creating reminders
axis_supabase_delta_reminders_*.sql  (new)      Supabase schema
test_reminders.mjs                   (new)      26 server tests
scripts/reminders_ui_debug.mjs       (new)      Playwright UI test
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

2. **Deploy the updated zip** (`axis_v5.1_reminders_server_ui_verified.zip`)
   to Vercel. The endpoint lives under `/api/daily?ns=reminders`. No new
   function file — it slots into the existing `daily.js` to stay under the
   12-function Hobby limit.

3. **Create a reminder** by visiting
   `https://your-domain.vercel.app/reminders.html` and using the form.

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
