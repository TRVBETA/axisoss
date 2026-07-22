# AXIS iOS Shortcut — Nutrition Sync

End-to-end MFP → Apple Health → AXIS sync, triggered by a single tap on
your iPhone. Zero automation, zero schedule — you run the Shortcut when
you want to sync.

## Files in this slice

- `AXIS_sync_nutrition.shortcut` — the iOS Shortcut (binary plist). Add
  ONE action inside it after import (the only piece that can't be
  shipped in the file). See step 3 below.
- `scripts/build_axis_nutrition_shortcut.py` — generator. Re-run to
  rebuild the .shortcut file from scratch.

## What the Shortcut does

```
MFP log  →  Apple Health (auto)  →  [Find Health Samples inside Shortcut]
          →  build entries array  →  POST /api/nutrition
          →  nutrition_logs row, source = MFP
          →  V4 score recalc
```

## One-time setup on the iPhone

### 1. MFP → Apple Health sync (one-time toggle)

- MyFitnessPal → More → Settings → Sync with Apple Health → **on**.
- Health app → Sharing → Apps → MyFitnessPal → confirm **Nutrition** on.

### 2. Get the Shortcut onto the iPhone

There are two ways:

**a) Install link from the AXIS Nutrition page (easiest).** Open AXIS
on the iPhone, go to the **Nutrition** page. Under "Primary source:
MyFitnessPal via Apple Health…" there's an "Install iOS Shortcut"
link. Tap it. iOS opens the Shortcuts app, asks you for the base URL
and the SHORTCUT_SHARED_SECRET, then adds the shortcut.

**b) Direct file transfer.** Send `AXIS_sync_nutrition.shortcut` to
the iPhone (Airdrop, Files, email attachment). Tap to open. iOS opens
Shortcuts, asks the same two questions, adds the shortcut.

### 3. Add the one action Shortcuts can't generate for us

The "Find Health Samples" action uses a private Apple framework
identifier. The exact ID changes between iOS versions and there's no
public list. So the .shortcut file ships with everything except this
one action. You add it once:

- Open the imported shortcut **AXIS sync nutrition** for editing.
- At the very top, above the existing "Set Variable: HealthSamples"
  action, tap **+** to add an action.
- Search for **Find Health Samples** and add it.
- Configure:
  - **Type**: `Dietary Energy` (or `HKQuantityTypeIdentifierDietaryEnergyConsumed` if you prefer raw ID)
  - **Source**: `MyFitnessPal`
  - **Start**: `1 hour ago`
  - **End**: `Now`
  - **Limit**: `50`
  - **Sort by**: `Newest First` (descending)
- Leave its output name as **Health Samples**.

That's the only manual step. After that the shortcut works forever.

### 4. Use it (zero trigger)

- Open **Shortcuts** app → tap **AXIS sync nutrition** → it runs.
- Or ask Siri: "Run AXIS sync nutrition."
- That's it. No automation, no "Open App" trigger, no schedule.

The shortcut pulls the last hour of MFP-written energy samples from
Apple Health, packages them as `{ entries: [{ logged_at, items: [...] }] }`,
POSTs to `/api/nutrition` with the shared secret header, and shows an
"AXIS nutrition synced" notification. Calories-only. P/C/F logged as
0 (the V4 score still weights calories correctly; the rest of the
breakdown isn't in the shortcut's reach yet — see Future below).

## Future

Once the basic pipeline is verified, the next slice will be a
**30-day backfill** that pulls historical MFP data via the same
endpoint, so the V4 nutrition score is accurate from deploy day
one instead of from "today forward only." That's a one-shot script,
not a real-time shortcut, so it won't be live in your face.
