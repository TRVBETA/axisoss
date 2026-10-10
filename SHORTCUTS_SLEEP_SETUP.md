# AXIS Sleep — lean automatic setup (recommended)

Two tiny iPhone automations. **~4 minutes total, set them once, forget them.**
No Health setup. No sleep apps. No schedule. No Repeat loops.

Server side is already live (9.zip): it stamps wake time, computes
your sleep window from the two events, feeds the daily score, and the
Sleep page labels the result **FROM YOUR TAPS** (vs MEASURED // HEALTH
if you ever upgrade — same page, zero extra work).

---

## Automation 1 — WAKE (fires when your alarm stops)

1. Shortcuts → **Automation** → **+**
2. Trigger: **Alarm** → **Is Stopped** → run on **Any Alarm**
   → **Run Immediately** → Next
3. Action: **Get Contents of URL**
   - URL: `https://YOUR-APP.vercel.app/api/sleep`
   - Method: **POST** · Request Body: **JSON**
   - Fields: `event` = `wake`, `secret` = your SHORTCUT_SHARED_SECRET

## Automation 2 — SLEEP anchor (fires at your bedtime)

1. Shortcuts → **Automation** → **+**
2. Trigger: **Time of Day** → e.g. **23:30**, **Daily**
   → **Run Immediately** → Next
3. Same action, body: `event` = `sleep`, `secret` = same secret

Pick the time you *intend* to sleep — honesty note: the duration the
site shows is "anchor → alarm" window. Wake times are real; durations
reflect your schedule, not your body. That's the lean trade-off,
stated plainly.

---

## If it ever misses a day
Nothing breaks. A missed event just means one missing data point —
the page fills it on the next successful day.

## Optional later: real measured data
If you ever put sleep data into Apple Health (Sleep schedule or a
sleep app), the site takes it automatically with the
**MEASURED // HEALTH** badge — the measured flow is documented at the
bottom of this file's git history; ask for it and we'll wire it up.
