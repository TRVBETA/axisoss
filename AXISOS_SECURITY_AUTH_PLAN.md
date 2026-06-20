# AXISOS Security & Easy Login Plan

_Last reviewed: 2026-06-20_

This document explains how to fix the exposed-key problem and how to make AXIS easier to enter on Vercel without asking for Supabase URL/key inside the app.

---

## 1) Immediate truth

### Public vs secret keys
For Supabase:
- **Project URL**: public
- **Anon key**: can be public **if RLS is correct**
- **Service role / secret key**: must **never** be in frontend code

### Current repo problem
`supabase.js` currently contains a secret-style key in browser code.
That is the urgent issue.

---

## 2) Immediate emergency fix

Do this first:

1. Go to Supabase project settings.
2. Rotate / revoke the exposed secret key.
3. Remove the hardcoded key from the repo.
4. Commit the cleanup.
5. Redeploy.

Also:
- stop storing Supabase credentials in browser localStorage for production
- remove the “paste URL/key” flow from normal user UX

---

## 3) Best architecture for AXIS right now

For a **single-user personal app**, the best setup is:

### Recommended model
- browser logs in with a **small PIN / passcode**
- Vercel serverless functions verify the PIN
- Vercel sets a secure session cookie
- frontend talks only to **your own `/api/*` routes**
- only server routes talk to Supabase using the secret key

### Why this is best
- no DB URL/key input in the UI
- no secret keys in frontend
- simple daily access
- good fit for a one-user personal fortress

---

## 4) Simpler but weaker alternatives

### Option A — frontend anon key + RLS
You can keep the anon key in frontend and rely on Supabase RLS.

Pros:
- fast
- common Supabase pattern

Cons:
- still exposes project URL + anon key publicly
- requires proper Supabase Auth and correct RLS everywhere
- current repo is not ready for this yet

### Option B — frontend-only PIN overlay
Store a PIN check only in local JS/localStorage.

Pros:
- very easy

Cons:
- not secure
- anyone can bypass it in browser dev tools

This is not recommended if you want a real fortress.

---

## 5) Recommended AXIS login flow

### User experience
1. Open AXIS URL.
2. See a clean passcode screen.
3. Enter short personal code.
4. Server verifies it.
5. Secure cookie is set.
6. AXIS opens.
7. Future visits stay logged in until logout/expiry.

This gives you the “small code and I’m in” experience you want.

---

## 6) What to store in Vercel env vars

Server-side env vars:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AXIS_PIN_HASH` or `AXIS_PIN`
- `SESSION_SECRET`

Optional later:
- `SUPABASE_ANON_KEY` if you decide to use client-side auth too

Important:
- never expose service role to frontend

---

## 7) Suggested production rule for config page

In production, `config.js` should **not** ask for:
- Supabase URL
- Supabase key

Instead it should only show:
- connection status
- your name
- theme
- module visibility
- maybe sync status

The deployment should already know database credentials through Vercel env vars.

---

## 8) Two clean implementation paths

## Path 1 — Best short-term: Custom PIN + server API

### Flow
- create `/api/login`
- create `/api/logout`
- create `/api/session`
- protect all important `/api/axis/*` endpoints using cookie
- move all DB reads/writes to Vercel API routes

### Result
Frontend no longer needs direct Supabase credentials.

### Good for
- one-user private app
- easiest secure daily usage

---

## Path 2 — More scalable: Supabase Auth + RLS

### Flow
- use Supabase email OTP / magic link
- frontend uses public anon key
- tables use `user_id = auth.uid()` policies

### Result
Proper auth architecture.

### Good for
- future multi-device, maybe multi-user growth

### Downside for AXIS today
- more setup
- not as instant as short passcode
- current schema would need refactor

---

## 9) What I recommend for AXIS specifically

### Recommendation
Use:
- **custom PIN login on Vercel**
- **server-only Supabase access**

Because AXIS is:
- personal
- single-user
- Vercel-hosted
- simple daily-entry workflow

This is the most natural fit.

---

## 10) Security cleanup checklist

### Must do now
- [ ] rotate exposed Supabase secret
- [ ] remove hardcoded secret from `supabase.js`
- [ ] stop storing secrets in localStorage
- [ ] stop asking for URL/key in config UI for production

### Should do next
- [ ] add passcode login API on Vercel
- [ ] add secure HTTP-only cookie session
- [ ] move writes/reads behind `/api/*`
- [ ] lock down Supabase RLS or use server-only service role access

### Nice later
- [ ] add device remember option
- [ ] add logout button in config
- [ ] add session timeout / re-auth after long inactivity

---

## 11) Practical migration plan

### Phase 1 — Stop the leak
- remove exposed key
- rotate key
- deploy cleaned version

### Phase 2 — Hide database complexity from user
- remove Supabase URL/key inputs from UI
- use Vercel env vars instead

### Phase 3 — Add easy access
- passcode screen
- login API
- session cookie

### Phase 4 — Move data access server-side
- replace direct DB browser calls with your own API routes

---

## 12) Important note about “anon key exposure”

If you later use Supabase in the browser:
- exposed **anon key** is normal
- exposed **service key** is never okay

So if GitHub warned you about an exposed API key, the critical question is:
- was it the **anon key**?
- or the **service/secret key**?

In this repo, the current pattern looks like a **secret-side issue**, which is why it needs immediate cleanup.

---

## 13) Best final UX target

Ideal AXIS production behavior:

- visit Vercel URL
- enter short passcode once
- dashboard opens
- no Supabase forms
- no manual key pasting
- all data sync happens invisibly in background

That is the cleanest version of AXIS.
