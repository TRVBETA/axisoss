# The Wanderer

A personal pixel-art interactive world. Not a game. Not a productivity app. A place.

You open it when the shutdown hits or the internal voice gets loud, and you step into something that has your specific coordinates. Weird and alive. Slightly surreal. Looks you in the face.

See `SPEC.md` for the full design.

## What it does

1. **Login** — same PIN as AXIS (`AXIS_PIN`). Reuses the AXIS session cookie.
2. **Pick a state** — five alchemical symbols:
   - 🜁 Static / frozen
   - 🜂 Restless / loud
   - 🜃 Grey / flat
   - 🜄 Functional but hollow
   - ◯ Clear / just checking in
3. **Enter a zone** — the world decides where you go based on what you picked:
   - **Field** (openness) — for static/frozen, and random for clear
   - **Room** (container) — for restless/loud and for hollow
   - **Road** (one direction) — for grey/flat
4. **Read the line** — the AI gives you one true thing, 10–15 words, in the air. It fades after 20 seconds. Not advice. Not motivation. Just a true thing.
5. **Touch the world** — 5 objects in each zone respond to taps with their own small animation. The bird flies. The planet glows. The cassette lifts. The notebook shows a line of poetry.
6. **Leave silently** — tap empty space, the figure walks off, the world fades. No exit screen.

## What it remembers

- Every visit is recorded (state, zone, line, was it a fallback)
- Every object touch is recorded
- After 5+ visits, the figure's posture shifts on entry
- After a day away, one object has moved
- After a week away, the sky shifts to late-evening rose

The world aged without you. Not guilt. Just time passed.

## Stack

- Vanilla HTML + JS + CSS, no build step, no framework
- Canvas: 640×360 logical, scales to viewport
- Web Audio API: procedural sound, no MP3s
- Supabase: 2 tables for memory
- Groq: AI line generation, with curated fallbacks
- Reuses AXIS session cookie for auth

## Files

```
wanderer/
  index.html         # PIN screen + canvas + mute button
  wanderer.css       # styles, palette, mute button
  wanderer.js        # entry logic, picker, canvas loop, interactions
  figure.js          # figure sprite (5 postures)
  zones.js           # three zone renderers with ambient animations
  objects.js         # per-zone hit-test rect definitions
  sound.js           # procedural ambient + click via Web Audio API
  SPEC.md            # design spec
  README.md          # this file
api/
  wanderer-line.js   # POST: AI line via Groq
  wanderer-visit.js  # POST: record visit
  wanderer-memory.js # GET: time-since-last + veteran flag + favorites
  wanderer-touch.js  # POST: record object touch
axis_supabase_delta_wanderer_2026-07-24.sql  # schema
test_wanderer_memory.mjs                      # structural tests
```

## Required Vercel env vars

Already shared with AXIS:
- `AXIS_PIN` (login)
- `GROQ_API_KEY` (AI line)
- `SUPABASE_URL` (memory)
- `SUPABASE_SECRET_KEY` (memory)
- `SESSION_SECRET` (cookie signing)

## How to use

Open `/wanderer/` in a browser. Type your AXIS PIN. Pick a state. Be in the world.

That's it. No settings, no nav, no menu, no buttons to push besides the mute icon and the things you tap in the world.

## Sound

Three ambient textures (one per zone), synthesized live:
- **Room** — low-mid filtered noise with a slow breath LFO and a 60Hz room tone
- **Road** — bandpass noise with two detuned gust LFOs and a 48Hz distant drone
- **Field** — wider bandpass with two compound gust LFOs and a faint high-frequency sheen

A soft click plays on every tap. Different body frequency per zone.

Mute via the circle icon in the top-right. Saved to `localStorage['wanderer_muted']`.

## Visual palette

Liminal warm. Amber `#c89c64`, dusty rose `#c98a82`, deep teal `#4a706e`, off-white `#ebe3d3`. The color of a room at 6pm when the sun hits at an angle. Slightly psychedelic but grounded.

## Hard constraints (non-negotiable)

- No streaks, no scores, no "you've been gone" guilt
- No "you did great today"
- No exit screen, no notifications, no sharing, no analytics
- The world is private. The AI line fades. The figure walks off silently.

## Tests

8 test files in the parent repo, all passing:

```
test_axis_v4_scoring.mjs
test_core_v4_integration.mjs
test_mfp_ingest.mjs
test_mfp_scraper.mjs
test_nutrition_parser.mjs
test_telegram_parser.mjs
test_telegram_route.mjs
test_wanderer_memory.mjs
```
