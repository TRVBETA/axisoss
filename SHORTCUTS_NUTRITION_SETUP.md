# AXIS iOS Shortcut — Nutrition Sync (Path B, manual build)

## Before you start

You need:
1. **Your AXIS domain** — like `axis-trv.vercel.app` (no `https://`)
2. **Your SHORTCUT_SHARED_SECRET** — the long random string from
   Vercel project settings → Environment Variables

## Step 1: create the shortcut

- Open the **Shortcuts** app on your iPhone
- Tap **+** (top right) to make a new shortcut
- At the top where it says "New Shortcut" or "Shortcut Name",
  tap and type: `AXIS sync nutrition`
- Tap **Done** on the keyboard

## Step 2: add Find Health Samples

The editor opens with a search bar at the bottom that says
"Search for apps and actions".

- Tap the search bar
- Type: `find health`
- The result "Find Health Samples" appears. Tap it.

A card with the action appears. It has these fields, top to
bottom, exactly as in the screenshot you sent:

| What you see on screen | What to do |
|---|---|
| A row at top: "Find **Health Samples**" with an X next to it | leave alone (this is the action name) |
| "where [All] of the following are true" | leave alone (this is the filter mode) |
| **Type** is (a button) | tap it. The picker shows a long list of Health types. Scroll to find **Dietary Energy**. Tap it. |
| **Start Date** is (a button) | tap it. The picker shows relative dates. Find and tap **in the last 1 hour** (NOT "in the last 1 day" — that's too broad). |
| **Add Filter** (a button with a +) | tap it. The picker shows filter options. Find **Source** (or "App"). Tap it. Then pick **MyFitnessPal** from the apps list. If MyFitnessPal isn't in the list, log a meal in MFP first — it only appears after MFP has written data. |
| **Unit** is `kcal` | leave it |
| **Group by** is `Day` | leave it |
| **Fill Missing** toggle is on (green) | leave it |
| **Sort by** is `None` | leave it |
| **Limit** toggle is on (green), value is `50` | leave it. The "Get 50 Health samples" text at the bottom of the action shows the result count. If it says "Get 0 Health samples", your Source filter or Start Date is wrong — try removing the Source filter and see if you get any results. |

That's step 2 done. Don't add anything else. Move to step 3.

## Step 3: add Set Variable (stores the Health samples list)

- At the bottom of the editor, there's the search bar again
  ("Search for apps and actions")
- Tap it, type: `set variable`
- Tap **Set Variable** in the results

A new card appears. It has:

- A small magic-variable icon on the LEFT (looks like a blue/purple
  rectangle with a tiny icon in it)
- A text field on the RIGHT labeled "Variable Name"

Set them:

| Field | What to do |
|---|---|
| Magic variable on the LEFT | **leave it alone** — it auto-fills with the previous action's output (the list of Health samples). If it's not auto-filled, tap the icon and select "Find Health Samples" from the list |
| **Variable Name** on the RIGHT | tap it, type: `HealthSamples` (no spaces, capital H, capital S). Tap **Done** on the keyboard |

The card now shows: `[Find Health Samples] Set variable **HealthSamples**`

## Step 4: add Repeat with each (starts a loop)

- Search bar at the bottom, type: `repeat`
- Tap **Repeat with each** (NOT "Repeat" — there's also a "Repeat N times" option, you want the one that says "with each")

A card appears. It has an "Items" or input field.

- Tap the input field for the repeat's "each" target
- A menu appears. Pick **Magic Variable**
- A list of variables appears. Pick **HealthSamples** (the one you
  just created in step 3)

The card now shows: `Repeat with each **HealthSamples**` and the
next actions will be **indented** under it (you'll see them
shifted slightly to the right). That indent means "this runs
inside the loop."

## Step 5: add Set Variable `calories` (INSIDE the loop)

The next action you add should appear **indented** (slightly to
the right) under the Repeat block. If it appears at the normal
indent, you added it in the wrong place — drag the action card
left or right to position it inside the loop.

- Search bar (now indented), type: `set variable`
- Tap **Set Variable**

A new card appears. It has the same two fields as step 3.

| Field | What to do |
|---|---|
| Magic variable on the LEFT | tap it. A menu appears with options for "current Health sample". The list might include names like "Quantity", "Value", "Energy (kcal)", or just a generic "Number". **Pick the one that has a number value** — that's the calories. The exact name varies by iOS version. If you see "Quantity" or "Value" or anything showing a `kcal` value, that's the one. If in doubt, pick the first number-looking option and we'll see in step 7 if it works. |
| **Variable Name** on the RIGHT | tap it, type: `calories` (lowercase, no spaces). Tap **Done**. |

The card now shows: `[Magic Variable] Set variable **calories**`

## Step 6: add Set Variable `logged_at` (still inside the loop)

Still indented. Same pattern.

- Search `set variable`, tap **Set Variable**

| Field | What to do |
|---|---|
| Magic variable on the LEFT | tap it. Look for **Current Date** in the list. Tap it. If you see a date picker, set it to **Current Date** (the default option in the picker). |
| **Variable Name** on the RIGHT | type: `logged_at` (with underscore). Tap **Done**. |

## Step 7: build the Dictionary (still inside the loop)

This is the hardest step. iOS Shortcuts' Dictionary action is
clunky. The shortcut will POST a JSON body that looks like this:

```json
{
  "logged_at": "2026-07-23T12:34:56Z",
  "items": [
    {
      "name": "meal item",
      "quantity": 1,
      "unit": "serving",
      "calories": 350,
      "protein": 0,
      "carbs": 0,
      "fat": 0
    }
  ]
}
```

iOS Shortcuts can't build this nested structure cleanly in one
Dictionary action. The simplest reliable path is **build the
inner item separately, then build the outer wrapper**. Two
Dictionary actions.

### Step 7a: build the inner item dictionary (inside the loop)

- Search `dictionary`, tap **Dictionary**
- The Dictionary action card appears. It shows "Add new item" button
- Tap "Add new item" 7 times. For each, fill in the key and value:

| # | Key (left field) | Type of value | Value (right field) |
|---|---|---|---|
| 1 | `name` | Text | literal text: `meal item` |
| 2 | `quantity` | Number | literal: `1` |
| 3 | `unit` | Text | literal: `serving` |
| 4 | `calories` | Number | **Magic Variable** → `calories` (from step 5) |
| 5 | `protein` | Number | literal: `0` |
| 6 | `carbs` | Number | literal: `0` |
| 7 | `fat` | Number | literal: `0` |

For each row:
- Tap the **Key** field (left), type the key name, tap **Done**
- Tap the **Value** field (right). The type indicator (Text/Number/Array/Dictionary) usually shows "Text" by default. If the value should be a number, tap the type indicator and change to **Number** BEFORE typing the value. Then type the number, tap **Done**.

When done, the Dictionary card should show 7 rows with the
keys and values. This represents ONE meal entry. The loop will
build one of these per Health sample.

### Step 7b: DON'T add the outer wrapper here. The simpler
approach: just use this inner dictionary as the body directly.

Read this carefully before continuing: the cleanest path is to
**not** build the `{"logged_at": ..., "items": [...]}` wrapper.
Instead, send the inner item dictionary directly to the server.
The server will accept a single entry just fine. We'll get
calories into AXIS, which is the goal.

If you want the full `entries` array structure (so multiple
meals go in one request), continue with step 7c. If you want to
ship the simpler version, skip to step 8.

### Step 7c (optional): build the outer wrapper

After step 7a, add a Set Variable called `entries` that holds an
**array** with the inner item dict inside it:

- Search `set variable`, tap **Set Variable**
- **Variable Name**: `entries`
- **Magic Variable**: tap it. You need to make this an array
  containing the inner dict. This is the part that varies by
  iOS version. The most reliable path:
  - Tap the magic variable slot
  - Look in the list for the inner dict (the one you just built
    in step 7a)
  - If the picker asks for type, change it to **Array** and add
    the inner dict as the single element
  - If you can't find the inner dict, set the magic variable to
    **Repeat Item** (which gives you the dict) and wrap it in an
    array manually using the iOS Shortcuts array operators
    (tap the type indicator, change to Array, add a single item)

This is genuinely the hardest step in iOS Shortcuts. If it
fights you, **skip 7c** and go with the single-entry path.

## Step 8: add End Repeat (OUTSIDE the loop)

The next action should appear at the **normal indent** (not the
indented indent). If it's still indented, drag the card left.

- Search `end repeat`, tap **End Repeat**

## Step 9: add Get Dictionary from Input

- Search `get dictionary`, tap **Get Dictionary**
- This action takes the loop's accumulated output and packages it
  for use as a JSON body. You usually don't need to change anything.

## Step 10: add Set Variable (stores the final entries)

- Search `set variable`, tap **Set Variable**
- **Variable Name**: `entries`
- **Magic Variable (left)**: tap it, select the output of
  "Get Dictionary from Input" (usually auto-populates)

## Step 11: add Get Contents of URL (the HTTP POST)

- Search `get contents of url`, tap **Get Contents of URL**

A card with several fields appears. Set them:

| Field | What to do |
|---|---|
| **URL** | tap, type: `https://YOUR-DOMAIN-HERE/api/nutrition` (replace YOUR-DOMAIN-HERE with your actual AXIS domain) |
| **Method** | tap the field (it probably says "GET"). The picker shows **GET**, **POST**, **PUT**, etc. Tap **POST**. |
| **Headers** | tap "Add new header" button. A row appears with two text fields. In the left field type: `Content-Type`. In the right field type: `application/json`. Tap "Add new header" again. In the left field type: `x-axis-secret`. In the right field type: your actual SHORTCUT_SHARED_SECRET value (paste it from Vercel, do NOT use a magic variable). |
| **Request Body** | tap the field (it probably says "Form" or "None"). The picker shows **None**, **Form**, **File**, **JSON**. Tap **File**. A new field appears below — tap it and select the **Magic Variable** for `entries` (from step 10). |

**Critical:** the body type MUST be **File**, not JSON. The JSON
mode is text-only and won't substitute the magic variable for
the entries dictionary. The File mode serializes the dictionary
as JSON automatically and supports magic variable substitution.

- **Show More** at the bottom: tap it. Turn off **"Show in Widget"**
  and any other unwanted share-sheet options. Don't change anything
  else.

## Step 12: add Show Notification (the last action)

- Search `notification`, tap **Show Notification**

| Field | What to do |
|---|---|
| **Title** | tap, type: `AXIS nutrition synced` |
| **Body** | tap, type: `Open AXIS to see today's entries.` |
| **Sound** | leave ON (green/blue toggle) |

## Step 13: save and test

- Tap **Done** (top right) to save the shortcut
- Open the Shortcuts app, find **AXIS sync nutrition** in your
  shortcuts list
- **Log a meal in MyFitnessPal** if you haven't recently (any food
  will do)
- **Wait 30 seconds** for MFP to sync to Apple Health
- **Tap the shortcut** to run it
- **You should see** the notification "AXIS nutrition synced" with
  a sound
- **Open AXIS in Safari** → tap **Nutrition** → new entries should
  appear in **Recent Entries** with a green **MFP** badge

## If the notification shows but no entries appear in AXIS

- Open the Shortcuts app, tap the shortcut
- Tap **"Show Actions"** at the top
- Run it. iOS will show each step and what it produced.
- The **Find Health Samples** step should show "Get N Health
  samples" where N is the count. If N is 0, the Source filter
  is wrong or MFP hasn't synced yet.
- The **Dictionary** step should show a 7-row dict with your
  calories number. If the calories field shows 0 or empty, the
  `calories` magic variable in step 5 was the wrong one. Go back
  to step 5, tap the magic variable slot, pick a different
  one.
- The **Get Contents of URL** step should show a JSON response
  from the AXIS server. If it says "Unauthorized", your
  SHORTCUT_SHARED_SECRET is wrong. Copy it again from Vercel.
- If it says "ENTRIES ARRAY REQUIRED", the body is empty. The
  `entries` variable in step 10 is wrong. Check that the magic
  variable in step 10 is the right one.

## If you got stuck on a step

Send me a screenshot. Tell me the step number and what's confusing.
I'll re-read the iOS docs for that specific action and tell you
what to tap.
