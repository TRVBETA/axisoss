# AXIS Agent Rules

Last updated: 2026-07-24

## Mission
Improve AXIS without draining user energy.
Do the thinking, reduce unnecessary back-and-forth, and preserve what already works.

## Hard rules
1. Do not break working features casually.
2. Do not replace real sync with fake local illusions.
3. Do not rerender active forms while the user is typing.
4. Do not add noisy alerts unless failure truly needs attention.
5. Do not exceed Vercel Hobby function limits.
6. Do not introduce complexity unless it solves a real bottleneck.
7. **Do not ship a new zip or new build without debugging it first.** A passing node --check and passing tests is not debugging. Debugging means: actually run it, in a browser, and confirm the user-visible flow works end-to-end. If the agent cannot do that, say so before shipping, do not ship and hope.
8. **Do not reuse the same zip filename when the contents have changed in a way that affects deployment.** Each substantive build gets a distinct filename or version suffix. Reusing axis_v5.1.zip for what is effectively a different build makes the user unsure which version is actually deployed. If the contents changed, the name changes.

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
5. current `/api` and `/lib` structure
