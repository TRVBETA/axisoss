# AXIS Sleep Shortcut Setup

Use this endpoint:

`https://YOUR-APP.vercel.app/api/sleep`

## Request method
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

## Shortcut goal
Wake up → tap shortcut → AXIS sleep updates.

## Suggested iPhone Shortcut
1. Read sleep duration from Health
2. Format wake time as text
3. Use `Get Contents of URL`
4. Method = POST
5. Body = JSON
6. Send the 4 fields above

If you want a second shortcut later for bodyweight / wake ritual, build it separately. For now, this single payload is the cleanest stable setup.
