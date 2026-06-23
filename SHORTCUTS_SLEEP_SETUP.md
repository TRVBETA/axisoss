# AXIS iPhone Shortcut Setup // Sleep Webhook

## Endpoint
Use your Vercel app URL:

`https://YOUR-APP.vercel.app/api/sleep`

## Recommended env var
Add one optional Vercel env var for protection:

- `SHORTCUT_SHARED_SECRET=your-secret-string`

## Shortcut payload
Create a `Get Contents of URL` action:

- Method: `POST`
- URL: `https://YOUR-APP.vercel.app/api/sleep`
- Request Body: `JSON`

JSON fields:
- `hours` → sleep hours number
- `wakeTime` → wake time string
- `quality` → optional 1-5
- `secret` → same value as `SHORTCUT_SHARED_SECRET`

Example body:
```json
{
  "hours": 7.4,
  "wakeTime": "06:25 AM",
  "quality": 4,
  "secret": "your-secret-string"
}
```

## Response check
A working response looks like:
```json
{
  "ok": true,
  "row": {
    "log_date": "2026-06-23",
    "hours_slept": 7.4,
    "wake_time": "06:25 AM"
  }
}
```

## AXIS sync
After posting from the iPhone Shortcut:
1. Open AXIS
2. Go to Sleep
3. Press `SYNC`

The latest sleep record should appear.
