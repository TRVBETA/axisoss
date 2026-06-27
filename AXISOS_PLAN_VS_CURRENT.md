# AXISOS Plan vs Current Repo

_Last reviewed: 2026-06-20_

## Short verdict

The repo still follows the original AXIS master plan closely in structure and intent, but it has now moved further into a server-backed personal OS model than the original prototype stage.

It is no longer just:
- a UI shell
- local module demos

It now also includes:
- Vercel auth
- Telegram fitness ingestion
- sleep shortcut webhook
- nutrition parsing/logging
- clipboard sync
- library sync
- core balance/todo data

---

## What still matches the old map

### Architecture
Still matches the original modular idea:
- `index.html`
- one JS file per module
- `styles.css`
- page-swap navigation
- persistent HUD shell

### Core concept
Still clearly the same project:
- personal OS
- one dashboard for real data
- score as truth
- daily accountability
- private one-user deployment

### Main modules
Still aligned with the original map:
- Core
- Fitness
- Sleep
- Music
- Library
- Design
- Nutrition
- Finance
- Config

---

## What evolved beyond the old map

### Server-backed sync layer
The old plan strongly implied sync and multi-device use, but now the repo has explicit Vercel API routes and Supabase-backed server flows for multiple modules.

### Telegram fitness bridge
Originally conceptual. Now it exists as a real Vercel endpoint with parser logic and optional Groq fallback.

### Nutrition direction
Originally a placeholder. Now a real nutrition parser/logging engine exists and was adapted from a separate nutrition bot project.

### Quick clipboard / relay idea
Not part of the original plan, but now exists as a very practical personal OS feature.

### Library sync
Originally more local-reader focused. Now there is a path toward true metadata/file sync across devices.

---

## Where the repo still lags behind the ideal plan

### Full stability
The project still suffers from iterative complexity. A lot of new sync features were added while old local behavior still exists in places.

### Design consistency
The original plan wanted a very precise refined visual system. The current repo is moving that direction, but still contains many inline styles and old HUD-era visual leftovers.

### Unified data model
The old dream was “one place where all real data lives.”
The current repo is moving there, but not every module is fully migrated yet.

### Mobile polish
The original plan assumed good daily usage on phone and desktop. The repo still needs more mobile refinement.

---

## Best updated interpretation

The current repo is best understood as:

> **A real Phase 2 AXIS build: the visual shell exists, the sync layer exists in important modules, and the project is transitioning from prototype logic into a true personal server-backed operating system.**

That means it is closer to the original dream than before — but also more sensitive to architecture mistakes.

---

## Best rule going forward

To stay aligned with the original plan, the repo should now prioritize:
1. stability
2. server-source-of-truth consistency
3. mobile usability
4. reduced UI noise
5. only then more feature expansion
