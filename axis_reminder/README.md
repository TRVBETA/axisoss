# AXIS Reminder — desktop app

A small Windows tray app that receives reminders from your AXIS server and
shows them as native Windows toasts. Polls using long-polling (one open HTTP
request at a time, held by the server up to 5 minutes), so it uses almost no
bandwidth.

## Install

Requirements: Windows 10 or 11, Python 3.10 or later.

```powershell
# From the axis_reminder/ directory:
pip install -r requirements.txt
```

If `pip` complains about Microsoft Visual C++ on Windows, install
"Microsoft C++ Build Tools" first. desktop-notifier uses WinRT on Windows
and shouldn't need a compiler, but Pillow sometimes does.

## Configure

Copy `config.example.json` to `config.json` and fill in:

```json
{
  "server": "https://your-axis-domain.vercel.app",
  "pin": "your-axis-pin"
}
```

`server` is the public URL of your AXIS deployment (no trailing slash).
`pin` is the same PIN you use to log into the dashboard.

## Run

```powershell
python axis_reminder.py
```

You should see an orange-dot icon appear in the system tray (you may need to
click the small ^ arrow to expand the tray). Right-click the icon for the
menu: Status, Check now, Mute 1h, Quit.

To run without the console window (cleaner for daily use), rename
`axis_reminder.py` to `axis_reminder.pyw` and run that instead. Or create a
shortcut and put it in your Startup folder (`Win+R`, `shell:startup`).

## How reminders are created

This app is a **receiver**, not a creator. To set a reminder:

1. Open `https://your-axis-domain.vercel.app/reminders.html` in any browser.
2. Type a title, optional note, pick when.
3. Submit.
4. The reminder is stored on the server. When the fire time arrives, the
   server holds the long-poll open and returns the reminder. This app
   shows the toast and acks the server.

The desktop app does **not** need to be on the same machine as the browser
where you created the reminder. As long as the desktop app is running on
any machine, it will receive the reminder.

## Long-polling, not WebSocket

The app opens one HTTP request at a time against
`/api/daily?ns=reminders&action=wait&timeout=290`. The server holds this
request for up to 290 seconds, then either returns the first due reminder
or `timed_out: true`. The app immediately reopens the request. In practice
this means one request per 5 minutes, very low bandwidth (~few KB per
5 minutes of headers, almost nothing when idle).

If the network drops, the app waits 30s and tries again.

## What I cannot test

This is a Windows-specific app. I cannot see:
- Whether the tray icon actually appears in your notification area.
- Whether the toast looks the way you want.
- Whether the toast sound is on/off by default (Windows 10 vs 11 behaviour
  differs; can be adjusted in Windows Settings > System > Notifications).
- Whether right-click menu feels right.
- Whether the autostart shortcut works.

You will be the first person to see it on a real desktop. If anything
looks wrong, tell me and I'll adjust.

## Uninstall

1. Right-click the tray icon, choose Quit.
2. Remove the Startup shortcut (if you made one).
3. Delete the `axis_reminder/` folder.
