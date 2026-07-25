# AXIS Handoff — full session context for the next agent

This document covers everything that happened across this whole chat session.
Read it before doing anything in this repo. The goal is to stop the agent
from repeating the loops the user has been frustrated by.

---

## 0. Who the user is and what they want

- One user. Owns the whole AXIS project. Single-user system (Protocol 6).
- Hates: flattery, repeated mistakes, agent shipping things it never tested,
  the agent claiming "verified" when it has only run `node --check`,
  the agent pretending it can make art / feel / design.
- Loves: short honest answers, real debugging before shipping, getting told
  "I can't do this" instead of getting code that doesn't work.
- Communication style: typos, lowercase, short, direct. Often frustrated.
  Will say "stop" or "wrap it up" when frustrated. Read those as real signals.
- They cannot view image previews. Screenshots shown via `read_file` are not
  visible to them. Describe what you see in text and ask them to open files
  in their own viewer if they need to see them.
- They do not use previews. No `*_preview.html` files.

## 1. The Wanderer — buried, do not touch

The wanderer is at `/wanderer/`. It is a pixel/illustrated interactive web
app, intended to feel like a personal world. Built over 9+ slices, multiple
rebuilds, never reached a state the user accepted.

**Do not write more wanderer code without explicit "go" from the user.**
The user described the result as "childish broken 2D screen of objects just
thrown up on the screen and no interactivity whatsoever no movement the
text dosent render in the right spot, just too many mistakes to give this
a 3/10." They explicitly said "bury that project."

The user values the wanderer work as a teaching example of what NOT to do
(over-promising, under-delivering, calling canvas-painted-pixels "verified"),
not as a project to continue.

If the user later asks to revisit the wanderer, they need different hands.
The agent should say this upfront and not try again.

## 2. Reminders — server done, desktop app incomplete

The user asked for a small Windows app that receives reminders from the AXIS
server and shows them as native toasts. The system was built in two parts:

### Part A: Server (working, tested)

In `axis_v5.1_reminders_server_ui_verified.zip` (MD5
`58639627f8e2f4084eac450469330d9a`):

- `api/daily.js` extended with `?ns=reminders` sub-router:
  - `POST {ns:'reminders',action:'create',title,body,fire_at}`
  - `POST {ns:'reminders',action:'ack',reminder_id}`
  - `GET ?ns=reminders&action=pending`
  - `GET ?ns=reminders&action=wait&timeout=S` — long-poll, 5 min cap
- `lib/remindersServer.js` — pure logic (sanitize, findDue, sleep)
- `axis_supabase_delta_reminders_2026-07-24.sql` — schema
- `reminders.html` — dashboard UI
- `test_reminders.mjs` — 26 tests, all pass
- `scripts/reminders_ui_debug.mjs` — Playwright UI test, 0 console errors

This part is solid. Don't redo it.

### Part B: Windows desktop app (broken, unverified)

In `axis_reminder_v1_windows.zip` (MD5 `852e0d23ee4b89219d2486ac05ed92d3`):

- `axis_reminder/axis_reminder.py` — Python 3.10+, deps: `desktop-notifier pystray Pillow requests`
- `axis_reminder/config.example.json` — copy to `config.json`, fill in server + PIN
- `axis_reminder/requirements.txt`
- `axis_reminder/README.md`
- `axis_reminder/dryrun.py` — 5 mocked tests, all pass

**This part has never been run on a real Windows machine.** The agent
wrote a dryrun harness that mocks `requests` and tests 5 paths. The
dryrun passes. The user then tried to run it on their real Windows PC
and got three real bugs in a row:

1. `NameError: name 'item' is not defined` — pystray 0.19+ moved menu
   helpers to `pystray.Menu` and `pystray.MenuItem`. Top-level shortcuts
   no longer exist. Fixed (lazy import inside `build_menu`).
2. `AttributeError: 'Response' object has no attribute 'status'` —
   `requests.Response` has `.status_code`, not `.status`. Fixed (2 spots).
3. `ValueError: not json` — Vercel returns HTML on function crashes even
   with 200 status. `r.json()` throws. Fixed (3 spots, with try/except).

The agent wrote the dryrun harness AFTER the user reported the third bug.
The dryrun only catches what the agent thought to mock. There is a real
risk of more bugs the moment the user runs the app on Windows again.

**The next agent must NOT call this "verified." It is "dryrun-passed."**

### What is broken / unverified in the desktop app

1. Never run on real Windows. The agent does not know if the tray icon
   appears, if the toast looks right, if the sound is correct, if the
   autostart shortcut works.
2. The Cancel button in the UI shows an error. It says "Cancellation
   not supported yet." Known V1 limitation, not a bug. To cancel, edit
   the Supabase row directly.
3. No re-auth on 401. If the PIN cookie expires, the app silently fails
   until restarted.
4. No timezone awareness in the UI. Uses the browser's local timezone.

### What the next agent should do for the desktop app

1. **Do not declare it done until someone has actually run it on real
   Windows.** The dryrun is not enough.
2. **When the user reports a crash, do not assume the next error is the
   last one.** The crash chain so far has been: undefined name → wrong
   attribute → non-JSON response. There may be more.
3. **If you don't have a way to test Python on Windows, say so upfront.**
   Don't ship a dryrun-tested zip and call it done.
4. **Sources the previous agent consulted** (per Rule 3):
   - `samschott/desktop-notifier` — WinRT toasts
   - `Stefangansevles/RemindMe` — tray+popup pattern
   - `ZekerTop/ai-cli-complete-notify` — recent tray+toast+webhook
   - CatLight — production tray+toast
   - Multiple SSE-vs-polling guides (alldevtoolshub, dev.to)

   The transport choice (long-polling, one HTTP request at a time held
   by the server up to 5 minutes) is right. The implementation may not be.

## 3. The 5 hard rules

These are the only protocol rules that matter. The previous agent had 10;
the user asked to trim to 5. The 5 are in `AXIS_AGENT_RULES.md`:

1. **Debug before shipping.** A passing `node --check` and passing unit
   tests is not debugging. Debugging means: actually run it, in a real
   browser, and confirm the user-visible flow works end-to-end. If the
   agent cannot do that, say so before shipping — do not ship and hope.

2. **Distinct zip filename per substantive build.** Reusing `axis_v5.1.zip`
   for what is effectively a different build makes the user unsure which
   version is actually deployed. If the contents changed in a way that
   affects deployment, the name changes.

3. **Research first, code second.** Before implementing any non-trivial
   feature, read 2-3 existing real-world implementations from public repos
   or documentation. State what sources were consulted before writing
   code, or admit none were found and stop. Do not invent from memory
   what you could look up.

4. **Recognize the limits of the model.** If a task is about making
   something feel like a place, a world, or art, and the agent does not
   have taste, visual judgment, or the ability to feel motion in static
   frames — say so before producing output. "The canvas painted pixels"
   is not the test. "The user looked at it and felt something" is the
   test. The agent must not call its own output "verified" based only
   on what it could see technically.

5. **Vercel Hobby has a 12-function limit. Do not exceed it.** New endpoint
   = new function. To add functionality, consolidate into existing
   functions (e.g. add a `?ns=` sub-router) or remove an unused one.
   Always count `ls api/*.js` before adding a new endpoint.

## 4. The mistake patterns to avoid

These are the loops the user has been frustrated by. The next agent
should not repeat them.

### Pattern 1: "I debugged it, the canvas is non-black"
The agent built the wanderer over many iterations. Each time it ran
Playwright in a sandbox, saw the canvas paint pixels, saw no JS errors,
and called it "verified." The user opened it on their real machine and
saw broken text placement, no movement, no atmosphere. The agent was
checking that the engine ran, not that the output felt right.

**Fix:** Rule 4 above. If the task is about feel/art/world, say so.
Run the user's eye over the output before declaring done.

### Pattern 2: "I shipped a zip with bugs and the user found them"
The agent shipped the Windows desktop app without running it on Windows.
Three real bugs were found one at a time by the user. Each fix exposed
the next bug. The user got frustrated.

**Fix:** Rule 1 above. The dryrun harness is a start but not enough.
Say "dryrun-passed" instead of "verified" until someone runs it on the
target platform.

### Pattern 3: "I renamed the same zip to the same name"
The agent built `axis_v5.1.zip` multiple times with different contents.
The user had multiple copies and didn't know which was deployed.

**Fix:** Rule 2 above. Each substantive build gets a distinct filename.
The previous filenames in this session were:
- `axis_v5.1.zip` (initial)
- `axis_v5.1_post_pin_debug_verified.zip` (after pin screen)
- `axis_v5.1_clean_illustrated_1920_tested.zip` (clean illustrated zones)
- `axis_v5.1_wanderer_brightness_lift_1920_verified.zip` (brightness lift)
- `axis_v5.1_reminders_server_ui_verified.zip` (server + UI for reminders)
- `axis_reminder_v1_windows.zip` (Python app, separate)

### Pattern 4: "I exceeded the 12-function Vercel Hobby limit"
The agent initially created a separate `api/reminders.js`. That would
have been 13 functions. The agent caught it and merged into `daily.js`
via a `?ns=reminders` sub-router. Stay alert: this is easy to miss.

**Fix:** Rule 5 above. `ls api/*.js` before adding any endpoint.

### Pattern 5: "I kept shipping when I should have said 'I can't'"
The agent kept shipping wanderer rebuilds even though it didn't have
taste / design judgment. The user said "you're doing everything wrong"
and asked me to wrap it up.

**Fix:** Rule 4 above. If the task is outside your capability, say so
before producing output. The user prefers "I can't" over "I shipped
something that doesn't work."

## 5. The user's priority list (their words)

1. Reminders
2. Tasks
3. Fitness
4. Nutrition
5. Stable clean UX

The user wants reminders working first. The server side of reminders
is done. The Windows app is not.

## 6. Files in the workspace

```
AXIS_AGENT_RULES.md            5 hard rules. Read first.
REMINDERS_HANDOFF.md            THIS file. Read second.
AXIS_IDENTITY.md                Project identity. Read third.
AXIS_STATE.md                   Current state. Read fourth.
AXISOS_MASTER_SUMMARY.md        Project history. Read fifth.
AXISOS_CHAT_HANDOFF.md          Previous chat handoff. Read sixth.
REMINDERS_SETUP.md              Reminders deployment guide.
api/                            12 serverless functions (Hobby limit).
lib/                            Shared server-side code.
wanderer/                       BURIED. Do not touch.
reminders.html                  Reminders dashboard UI.
test_*.mjs                      Test files. Run with `npm test`.
scripts/wanderer_*.mjs          Wanderer debug harnesses. Buried with the wanderer.
scripts/reminders_ui_debug.mjs  Reminders UI test harness.
axis_reminder/                  Windows app + dryrun harness. Untested on Windows.
axis_supabase_delta_*.sql       Database migrations. Apply via Supabase SQL editor.
```

## 7. What the previous agent did NOT do

- Run the Windows app on real Windows.
- See the actual toast on the user's screen.
- See the actual tray icon in the user's notification area.
- Hear the actual sound.
- Get the user's eyes on the result before declaring done.

These are not optional. If the next agent does any of the above work
without doing these, the user will be frustrated again.

## 8. The user's last words

"wrap it up ur time is done here and ur doing everything wrong extract
the only most important 5 protocols and not all of them and create a
handoff in the ur latest zip and hand over ur incomapanet notifciation
codes and give me the zip keep ur mess in the folder for the next
chat to fix it"

"not just the reminder handoff everything in that chat add it too the
handoff not the mess u made the overall look to not go in these loops
and mistakes again"

Translation:
- Trim the rules to 5.
- The handoff should cover EVERYTHING in the chat, not just reminders.
- Include the patterns to avoid so the next agent doesn't repeat them.
- Hand over the buggy notification code as-is.
- The mess stays in the folder for the next agent to fix.
- This document is what stops the next agent from re-entering the same loops.

## 9. Last commit

`ab9392b docs: trim rules to 5 hard rules + add REMINDERS_HANDOFF.md`
on branch `cleanup/v5-pass1`.
