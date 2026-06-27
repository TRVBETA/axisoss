# AXISOS Security & Auth Plan

_Last reviewed: 2026-06-20_

## Current model
AXIS uses:
- Vercel API routes
- server-side Supabase secret usage
- browser session cookie auth
- optional identifier + PIN login

This remains the correct direction for a one-user private system.

## Frontend should never contain
- Supabase secret/service key
- Telegram token
- Groq key
- USDA key
- shared shortcut secrets

## Current auth route
- `api/auth.js`

Supports:
- login
- logout
- session check behavior through the same merged route pattern

## Current env vars
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `AXIS_PIN`
- `AXIS_LOGIN_NAME` (optional)
- `SESSION_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `AXIS_MASTER_CHAT_ID`
- `GROQ_API_KEY` (optional)
- `USDA_API_KEY` (optional)
- `SHORTCUT_SHARED_SECRET` (optional)
- `CLIPBOARD_SHARED_SECRET` (optional)

## Current deployment constraint
Because Vercel Hobby limits serverless function count, routes are intentionally merged.
Do not casually split every action into a separate API file unless function count is rechecked.

## Current security recommendation
Keep using:
- server-only Supabase secret
- cookie session auth
- protected shortcut secrets for phone webhooks when needed
