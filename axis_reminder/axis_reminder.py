"""
AXIS Reminder — a quiet tray app that receives reminders from the AXIS server
and shows them as native Windows toasts.

How it works
------------
1. On boot, reads axis_reminder/config.json (server URL + PIN).
2. Logs in via /api/auth to get an axis_session cookie.
3. Spawns the tray icon (pystray) in its own thread.
4. Spawns the long-poll loop in another thread. Every ~5 minutes, it holds
   one HTTP request open against /api/daily?ns=reminders&action=wait. The
   server holds the request until a reminder is due, then returns it.
5. For each reminder returned, fires a native Windows toast via
   desktop-notifier, then POSTs /api/daily (action=ack) to mark it delivered.
6. Tray menu has: Status (shows last-poll result), Check now, Mute 1h, Quit.

Install
-------
  pip install -r requirements.txt

Run
---
  python axis_reminder.py

The first run will fail because config.json doesn't exist. Copy
config.example.json to config.json, edit it, and run again.

To auto-start with Windows: press Win+R, type shell:startup, and put a
shortcut to axis_reminder.pyw (rename .py to .pyw to hide the console).
"""

import json
import os
import sys
import time
import threading
import traceback
from datetime import datetime, timezone
from pathlib import Path

import requests
from PIL import Image, ImageDraw
# desktop_notifier and pystray are imported lazily inside the functions that
# actually need them, so that headless / non-GUI machines (e.g. CI, Linux
# servers) can still import this module without crashing on missing GUI deps.


# ----- Config -----

APP_DIR = Path(__file__).parent
CONFIG_PATH = APP_DIR / 'config.json'
ICON_PATH = APP_DIR / 'icon.png'
EXAMPLE_CONFIG_PATH = APP_DIR / 'config.example.json'


def load_config():
    if not CONFIG_PATH.exists():
        if EXAMPLE_CONFIG_PATH.exists():
            print(f'No config.json found. Copy {EXAMPLE_CONFIG_PATH} to {CONFIG_PATH} and edit it.', file=sys.stderr)
        else:
            print('No config.json and no config.example.json found. Create config.json first.', file=sys.stderr)
        sys.exit(1)
    with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)


# ----- Icon -----

def ensure_icon():
    """Generate a small orange-dot icon if one isn't present."""
    if ICON_PATH.exists():
        return str(ICON_PATH)
    # 32x32, amber on transparent
    size = 32
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Soft outer ring
    draw.ellipse([(2, 2), (size - 3, size - 3)], outline=(200, 156, 100, 220), width=2)
    # Filled center
    draw.ellipse([(12, 12), (20, 20)], fill=(200, 156, 100, 255))
    img.save(ICON_PATH)
    return str(ICON_PATH)


# ----- Session -----

def login(server, pin):
    """POST /api/auth to exchange the PIN for an axis_session cookie. Returns the cookie header string."""
    r = requests.post(
        server.rstrip('/') + '/api/auth',
        json={'action': 'login', 'pin': pin},
        timeout=15,
    )
    if not r.ok:
        raise RuntimeError(f'Auth HTTP {r.status_code}: {r.text[:200]}')
    data = r.json()
    if not data.get('ok'):
        raise RuntimeError(f'Auth failed: {data.get("error", "unknown")}')
    # Pull the cookie from the response
    cookie = r.cookies.get('axis_session')
    if not cookie:
        # Some Vercel setups don't expose Set-Cookie through requests; build from scratch
        # using the dev fallback secret. Real prod should return the cookie properly.
        raise RuntimeError('No axis_session cookie in response. Check auth response headers.')
    return f'axis_session={cookie}'


# ----- Long-poll loop -----

class State:
    """Shared between the poll thread and the tray thread."""
    def __init__(self):
        self.last_poll_at = None
        self.last_result = 'not yet polled'
        self.last_error = None
        self.muted_until = 0  # epoch seconds
        self.quit = False

    def is_muted(self):
        return time.time() < self.muted_until


def poll_loop(server, cookie, state, notifier):
    """Long-poll loop. Holds one HTTP request at a time, up to 5 minutes."""
    while not state.quit:
        try:
            url = server.rstrip('/') + '/api/daily?ns=reminders&action=wait&timeout=290'
            r = requests.get(url, headers={'Cookie': cookie}, timeout=300)
            state.last_poll_at = datetime.now(timezone.utc).isoformat()
            if not r.ok:
                state.last_result = f'HTTP {r.status_code}'
                state.last_error = r.text[:200]
                time.sleep(30)
                continue
            # Some servers return HTML on errors even with 200 (e.g. Vercel
            # function crashed). Guard the JSON parse.
            try:
                data = r.json()
            except ValueError:
                state.last_result = 'non-JSON response'
                state.last_error = r.text[:200]
                time.sleep(30)
                continue
            if not data.get('ok'):
                state.last_result = f'server: {data.get("error", "unknown")}'
                time.sleep(30)
                continue
            reminders = data.get('reminders') or []
            if reminders:
                state.last_result = f'{len(reminders)} reminder(s) delivered'
                for rem in reminders:
                    if state.is_muted():
                        # Still ack so the server doesn't re-deliver, but don't notify
                        pass
                    else:
                        try:
                            notifier.send(
                                title=rem['title'],
                                message=rem.get('body') or '',
                                urgency='normal',
                                icon=str(ICON_PATH),
                            )
                        except Exception as e:
                            print(f'[notifier] send failed: {e}', file=sys.stderr)
                    # Always ack, even if muted, to prevent re-delivery
                    try:
                        ar = requests.post(
                            server.rstrip('/') + '/api/daily?ns=reminders',
                            headers={'Cookie': cookie, 'Content-Type': 'application/json'},
                            json={'ns': 'reminders', 'action': 'ack', 'reminder_id': rem['id']},
                            timeout=10,
                        )
                        if not ar.ok:
                            print(f'[ack] HTTP {ar.status_code} for id={rem["id"]}: {ar.text[:100]}', file=sys.stderr)
                    except Exception as e:
                        print(f'[ack] failed for {rem["id"]}: {e}', file=sys.stderr)
            else:
                # Timeout — no reminders due
                state.last_result = 'idle (no reminders)'
        except requests.exceptions.Timeout:
            # Long-poll server-side timeout. Reopen.
            state.last_poll_at = datetime.now(timezone.utc).isoformat()
            state.last_result = 'idle (long-poll timeout)'
        except Exception as e:
            state.last_error = f'{type(e).__name__}: {e}'
            state.last_result = 'error (see status)'
            print(f'[poll] error: {e}', file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            time.sleep(30)  # back off on errors


# ----- Tray -----

def build_menu(state, on_check_now, on_mute_1h, on_quit):
    from pystray import Menu, MenuItem as item
    def status_text(_):
        return f'Last poll: {state.last_poll_at or "never"}'
    return Menu(
        item(status_text, None, enabled=False),
        item(f'Result: {state.last_result}', None, enabled=False),
        item('Check now', on_check_now),
        item('Mute 1h', on_mute_1h),
        Menu.SEPARATOR,
        item('Quit', on_quit),
    )


def run_tray(state, on_check_now, on_mute_1h, on_quit):
    import pystray
    from pystray import Icon
    icon_path = ensure_icon()
    image = Image.open(icon_path)
    menu = build_menu(state, on_check_now, on_mute_1h, on_quit)
    icon = Icon('axis_reminder', image, 'AXIS Reminder', menu)
    icon.run()


# ----- Main -----

def main():
    config = load_config()
    server = config['server']
    pin = config.get('pin', '')

    print(f'[boot] server={server}')

    if pin:
        print('[boot] logging in...')
        cookie = login(server, pin)
        print('[boot] logged in')
    else:
        # Re-use an existing cookie from config (for setups where the user
        # does the PIN flow once and pastes the cookie).
        cookie = config.get('cookie')
        if not cookie:
            print('No pin and no cookie in config.json. Add one.', file=sys.stderr)
            sys.exit(1)
        print('[boot] using pre-set cookie')

    state = State()
    # Lazy import: desktop_notifier may not work on a headless machine.
    from desktop_notifier import DesktopNotifier
    notifier = DesktopNotifier(app_name='AXIS Reminder')

    # Start poll thread
    poll_thread = threading.Thread(
        target=poll_loop, args=(server, cookie, state, notifier), daemon=True
    )
    poll_thread.start()

    # Tray callbacks
    def on_check_now(icon, item):
        # Force a poll-cycle break by re-issuing a GET against /api/daily?ns=reminders&action=pending
        try:
            r = requests.get(
                server.rstrip('/') + '/api/daily?ns=reminders&action=pending',
                headers={'Cookie': cookie}, timeout=10
            )
            if not r.ok:
                notifier.send(title='AXIS', message=f'Check failed: HTTP {r.status_code}')
                return
            try:
                data = r.json()
            except ValueError:
                notifier.send(title='AXIS', message='Check failed: non-JSON response')
                return
            count = len(data.get('reminders') or [])
            notifier.send(title='AXIS', message=f'{count} pending reminder(s).')
        except Exception as e:
            notifier.send(title='AXIS', message=f'Check failed: {e}')

    def on_mute_1h(icon, item):
        state.muted_until = time.time() + 3600
        notifier.send(title='AXIS', message='Reminders muted for 1 hour.')

    def on_quit(icon, item):
        state.quit = True
        icon.stop()

    # Start tray (blocking)
    run_tray(state, on_check_now, on_mute_1h, on_quit)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('\n[exit] interrupted')
        sys.exit(0)
