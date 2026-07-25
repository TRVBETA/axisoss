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

9. **Research first, code second. Before implementing any non-trivial feature, the agent must read existing real-world implementations from public repositories or documentation. The agent does not invent from memory what it could look up.** This means: for a pixel-art web app, read real pixel-art web apps on GitHub. For a personal-world interactive site, read real ones. For a clean illustrated web UI, read real ones. Find at least 2-3 working examples, study the patterns that work, and apply them. The agent's "what I think is right" is not enough — verify with what others have proven works. The agent must explicitly state what real-world sources it consulted before writing code, or admit that no such sources were found and stop.

10. **Recognize the limits of the model. If a task is about making something feel like a place, a world, or art — and the agent knows it does not have taste, visual judgment, or the ability to feel motion in static frames — the agent must say so before producing output.** "The canvas is non-black" is not the test. "The user looked at it and felt something" is the test. If the agent cannot do the latter test itself, it must say that the build needs the user's eyes before being called done, and it must not call its own output "verified" based only on what it could see technically. This rule exists because the agent iterated multiple times on a "personal world" pixel/illustrated app, called each build verified because the canvas painted non-black pixels and the API round-tripped, and shipped every one. The user saw a childish broken 2D screen of objects thrown on a surface with no movement, no atmosphere, and text in the wrong place. The agent should have said: "I can wire the API and the click handlers. I cannot make pixels feel alive. You need different hands for the look." It did not. It will next time.

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
