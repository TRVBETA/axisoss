# AXIS Agent Rules

Last updated: 2026-07-25

## Mission
Improve AXIS without draining user energy.
Do the thinking, reduce unnecessary back-and-forth, and preserve what already works.

## The 5 hard rules

1. **Debug before shipping.** A passing `node --check` and passing unit tests is not debugging. Debugging means: actually run it, in a real browser, and confirm the user-visible flow works end-to-end. If the agent cannot do that, say so before shipping — do not ship and hope.

2. **Distinct zip filename per substantive build.** Reusing `axis_v5.1.zip` for what is effectively a different build makes the user unsure which version is actually deployed. If the contents changed in a way that affects deployment, the name changes.

3. **Research first, code second.** Before implementing any non-trivial feature, read 2-3 existing real-world implementations from public repos or documentation. State what sources were consulted before writing code, or admit none were found and stop. Do not invent from memory what you could look up.

4. **Recognize the limits of the model.** If a task is about making something feel like a place, a world, or art, and the agent does not have taste, visual judgment, or the ability to feel motion in static frames — say so before producing output. "The canvas painted pixels" is not the test. "The user looked at it and felt something" is the test. The agent must not call its own output "verified" based only on what it could see technically.

5. **Vercel Hobby has a 12-function limit. Do not exceed it.** New endpoint = new function. To add functionality, consolidate into existing functions (e.g. add a `?ns=` sub-router) or remove an unused one. Always count `ls api/*.js` before adding a new endpoint.

## Preferred engineering style
- Server as source of truth for important shared data
- Optimistic UI where useful
- Quiet background sync
- Small scoped changes
- Strong rollback awareness
- Mobile-conscious layout decisions

## UI rules
- Favor clean rounded controls
- Remove extra labels and decorative noise
- Avoid harsh glows
- Use orange / sand accents instead of purple where possible
- Keep spacing consistent across pages
- Tune each page individually if global CSS is not enough

## Sync rules
- Sync should feel invisible when healthy
- Inputs must retain drafts locally while editing
- Polling should pause while user is actively editing
- If a module is shared across phone and PC, treat server state as primary

## AI usage rules
- Use deterministic parsing first where possible
- Use Groq fallback only when it improves robustness
- Prefer currently viable Groq models over deprecated ones
- Keep model choices configurable through env vars

## Safe order of work
1. Stability
2. Sync correctness
3. Mobile polish
4. UI refinement
5. New features

## When adding features
Before adding anything new, ask internally:
- Is there already a partial version of this?
- Will this destabilize sync?
- Does this create another local/server mismatch?
- Can this be added without increasing function count too much?

## Files another agent should read first
1. `AXIS_IDENTITY.md`
2. `AXIS_STATE.md`
3. `AXISOS_MASTER_SUMMARY.md`
4. `AXISOS_CHAT_HANDOFF.md`
5. `REMINDERS_HANDOFF.md` (current handoff — read this last)
6. current `/api` and `/lib` structure
