# AXIS State

Last updated: 2026-07-02

## Current top priorities
1. Make cross-device sync reliable
2. Make mobile Safari usable
3. Keep typing/editing safe during background sync
4. Stabilize library upload + reading across devices
5. Keep fitness as a first-class module
6. Reduce UI noise and visual inconsistency

## Current critical modules
### High priority
- Core
- Fitness
- Sleep
- Nutrition
- Library

### Medium priority
- Design
- Clipboard / quick capture
- Core balance / todos

### Lower priority for now
- Music
- Finance

## Current operating constraints
- Vercel Hobby function count limit must be respected
- Internet can be unstable sometimes
- Server-backed truth is preferred where practical
- Agents should avoid broad destructive rewrites
- Background sync must not wipe text input or cause UI fights

## Current backend assumptions
- Vercel handles API routes
- Supabase is the database + storage backend
- Telegram is used for fitness logging
- iPhone Shortcuts are used for sleep and quick capture
- Optional Groq fallback exists for messy parsing

## Current problem areas to watch
- Library PDF reader reliability
- EPUB load timing
- Sync timing vs. local form editing
- Old local-first behavior mixed with newer server sync behavior
- Mobile layout drift between pages

## What “good” looks like right now
- Save something on one device and see it on the other quietly
- Type into a box without it resetting
- Open a book on one device and continue on another
- Log fitness quickly and trust the data
- Keep the interface calm, minimal, and fast

## Current rules for future work
- One stability pass at a time
- Prefer merged server routes over too many separate API files
- Avoid fake local-only state for important data
- Preserve existing useful features while improving architecture
