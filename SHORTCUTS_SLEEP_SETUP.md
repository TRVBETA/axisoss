# AXIS Sleep Shortcut Setup

Endpoint:

`https://YOUR-APP.vercel.app/api/sleep`

## Method
POST

## JSON body
```json
{
  "hours": 7.4,
  "wakeTime": "06:25 AM",
  "quality": 4,
  "secret": "your-shortcut-secret"
}
```

## Field types
- `hours` → Number
- `wakeTime` → Text
- `quality` → Number
- `secret` → Text

## Practical flow
Wake up → tap shortcut → AXIS receives the sleep log.

If you later want a second shortcut for bodyweight or wake ritual, keep that separate. This one should remain simple and stable.
