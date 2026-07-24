# The Wanderer — SPEC

A personal pixel-art interactive world. Not a game. Not a productivity app. A place.

You open it when the shutdown hits or the internal voice gets loud. You step into something that has your specific coordinates. Weird and alive. Slightly surreal. Looks you in the face.

## Stack

- **Frontend:** Vanilla HTML + JS + CSS. No build step. No framework. Served as a sub-route at `/wanderer/`.
- **Canvas:** HTML5 Canvas API, single 640×360 logical canvas, scales down on phone.
- **State:** vanilla JS module state. React not used (would be overkill for a 640×360 canvas with 5 buttons).
- **AI:** Groq API (`llama-3.3-70b`), called once on entry. One line, 10–15 words. Fades after 20s.
- **Memory:** Supabase (visits, object touches, last line). Single user.
- **Auth:** Reuses AXIS session cookie (`axis_session`). PIN login posts to `/api/auth`.

## The world

### Three zones

- **The Road** — long path, night sky, one light source far ahead. The figure walks.
- **The Room** — small interior, single window, ambient light. The figure sits. Things appear on a desk slowly.
- **The Field** — open space, wind in the grass, something in the distance. The figure stands. Choices appear as objects, not text.

### The figure

16×16 or 32×32 pixels. Dark outline. No face. Expressive only through posture.

### Palette

Liminal warm. Amber, dusty rose, deep teal, off-white. The color of a room at 6pm when the sun hits at an angle. Slightly psychedelic but grounded.

## Entry state — the only input

Five alchemical symbols as buttons, not words:

| Symbol | Meaning |
|---|---|
| 🜁 | Static. Frozen. |
| 🜂 | Restless. Loud inside. |
| 🜃 | Grey. Flat. |
| 🜄 | Functional but hollow. |
| ◯ | Clear. Just checking in. |

Tap one. World opens. That's the only input.

## State → zone mapping

The zone should do the **opposite** of what the state needs to escape, not mirror it.

| State | Zone | Reason |
|---|---|---|
| 🜁 Static / Frozen | **Field** | Openness is the antidote to frozen. Nowhere to be. Horizon visible. Nothing demands movement. |
| 🜂 Restless / Loud | **Room** | Container. Four walls. The noise needs to be held somewhere small and quiet. |
| 🜃 Grey / Flat | **Road** | One direction. One light ahead. Not asking for feeling, just forward. |
| 🜄 Functional but hollow | **Room** | Already performing. Needs somewhere that doesn't require anything. |
| ◯ Clear | **Random between all three** | The only state where surprise is safe. |

**Time-since-last-visit** modifies *within* the zone, not the zone itself:

- **< 24h:** world looks the same, figure posture slightly more settled
- **> 1 week:** one object has moved, sky is different time of day, the planet on the shelf has rotated

The world aged without you. Not guilt. Just time passed.

## AI line — Groq

Fires once on entry. Returns one line, 10–15 words. Appears as faint environmental text in the world. Fades after 20 seconds.

**System prompt:**

```
You are the voice of a personal world belonging to a young Arab creator.
He makes dark psychedelic music, writes poetry, and is building a philosophy
of conscious living and intellectual independence — a project that is entirely
his own, built from nothing, against the current.

He has entered his world in this state: [STATE].

Write exactly ONE line. 10-15 words. It is not advice. It is not motivation.
It is a true thing — the kind of line that makes someone feel seen, not fixed.

Archaic register is welcome. Do not mention any name. Do not explain anything.
Just the line.
```

## Objects (tap → small visual response, not menus)

**The Road:**
- A bird on a wire → tap → stays a moment, then flies. Path gets slightly brighter.
- A door in the middle of the road → tap → opens to the same road from a different angle.
- A cassette tape on the ground → tap → the figure picks it up, holds it. Something in the sky shifts color.
- A light post → tap → light pulses once, brighter, then returns to baseline.
- A sign → tap → the figure looks up at it, then looks back down.

**The Room:**
- A notebook on the desk → tap → a single line of poetry appears, rotates between saved personal lines. Fades.
- A window → tap → outside changes. Day or night, rain or still.
- A small planet on the shelf → tap → rotates slowly, glows once. The marker for the creator's mission.
- A lamp → tap → toggles. Room gets warmer/cooler.
- A chair → tap → figure sits. Figure stands again on second tap.

**The Field:**
- Two roads diverging → walk one → the other doesn't disappear. Still there next time.
- A fire in the distance → approach → figure sits. Small warmth animation. Then return.
- A grass clump → tap → wind ripples through it.
- A horizon marker → tap → shimmer effect, the distance gets clearer for a moment.
- A small stone → tap → figure picks it up, holds it, then puts it down elsewhere.

## Hard constraints (non-negotiable)

- No streaks
- No scores
- No "you've been gone a while" guilt
- No "you did great today"
- No exit screen
- No notifications
- No sharing
- No analytics

## Architectural rules (locked from agent feedback)

1. **Canvas owns the world.** React does not. (Vanilla JS here, same principle.) A `requestAnimationFrame` loop inside a single init function. Canvas redraws every frame from a state object.
2. **Every zone needs one looping ambient animation** that runs forever in the background, even if nothing else is happening. Figure breathes (2-frame chest cycle), background shifts slowly (light flicker, distant grass, rain). 20% of the feeling, 0% of the feature list.
3. **Silent exit.** When the user taps the entry symbol a second time (or holds it), the figure walks off-screen slowly, world fades. No words. Just a natural leave. Feels like closing a book, not killing a process.

## Slice plan

1. **Slice 1 (shipped, `6b90d23`):** scaffold, PIN page, 5 alchemical symbols, zone reveal animation.
2. **Slice 2 (shipped, `e85ea23`):** three zones drawn. Figure sprite. Object sprites. Per-zone ambient animations.
3. **Slice 3 (shipped, `22251ca`):** procedural sound via Web Audio API. Per-zone ambient textures. Soft click. Mute icon.
4. **Slice 4 (shipped, `341cbcc`):** AI line via Groq (`/api/wanderer-line`). Curated fallbacks. Fades 1s/holds 18s/fades 1s.
5. **Slice 5 (shipped, `747f351`):** Supabase memory layer. `wanderer_visits` + `wanderer_object_touches` tables. Time-since-last-visit modifier. 5+ visits = veteran.
6. **Slice 6 (shipped, `ba55b72`):** object interactions on all 15 objects across 3 zones. Responses recorded to Supabase.
7. **Slice 7 (shipped, `f569011`):** silent exit. Figure walks off, world fades over 2.2s.
8. **Slice 8 (shipped, `17ed770`):** visual depth pass. More stars, more grass, dust motes, drifting cloud, drifting glyphs, 5th figure posture.
9. **Slice 9 (current):** final pass. Tests, README, SPEC update.
