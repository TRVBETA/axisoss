# Dry-run test for the Python app. Doesn't actually open a tray (Linux can't)
# but exercises: config load, login, the poll loop body, error handling.

import sys
import os
import json
from pathlib import Path
from unittest.mock import patch, MagicMock

# Pre-set the env to skip the real boot
sys.path.insert(0, str(Path(__file__).parent))

# Stub requests before importing the app
import requests

calls = []
def fake_post(url, **kwargs):
    calls.append(('POST', url, kwargs))
    r = MagicMock()
    r.status_code = 200
    r.json.return_value = {'ok': True, 'message': 'ACCESS GRANTED'}
    r.cookies = {'axis_session': 'fake_cookie_value'}
    r.text = json.dumps(r.json.return_value)
    return r

def fake_get(url, **kwargs):
    calls.append(('GET', url, kwargs))
    r = MagicMock()
    r.status_code = 200
    r.json.return_value = {'ok': True, 'reminders': [], 'timed_out': True}
    r.text = json.dumps(r.json.return_value)
    return r

# Replace at the module level where the app imports it. The app does
# `import requests` and then `requests.post(...)`, so we need to patch
# the `post` and `get` attributes on the requests module that the app
# already loaded. Since we haven't imported the app yet, we patch
# requests directly and the app will see the patched version.
requests.post = fake_post
requests.get = fake_get

# Import the app after patching requests
import axis_reminder as app
# Don't restore — we want the mocks to stay in place for the duration of
# the test so the poll thread uses them too.

# Test 1: config load
print('[test] config load')
try:
    cfg = app.load_config()
    print('  OK: loaded config, server=', cfg['server'])
except SystemExit as e:
    print('  SKIP: no config.json (expected if you haven\'t created one yet)')

# Test 2: login builds cookie string
print('[test] login()')
cookie = app.login('https://example.com', '1234')
print('  OK: cookie =', cookie[:30] + '...')
assert cookie.startswith('axis_session=')

# Test 3: poll_loop handles timeout (no reminders due) cleanly
print('[test] poll_loop on empty queue')
state = app.State()
notifier = MagicMock()
import threading
t = threading.Thread(target=app.poll_loop, args=('https://example.com', cookie, state, notifier), daemon=True)
t.start()
import time
time.sleep(1)
state.quit = True
t.join(timeout=2)
print('  OK: last_result =', state.last_result)
assert state.last_error is None, f'unexpected error: {state.last_error}'

# Test 4: poll_loop handles a 500 response (server returns JSON error)
print('[test] poll_loop on 500 response')
def fake_get_500(url, **kwargs):
    r = MagicMock()
    r.status_code = 500
    r.ok = False
    r.json.return_value = {'ok': False, 'error': 'INTERNAL'}
    r.text = '{"ok":false,"error":"INTERNAL"}'
    return r
requests.get = fake_get_500
state2 = app.State()
notifier2 = MagicMock()
t2 = threading.Thread(target=app.poll_loop, args=('https://example.com', cookie, state2, notifier2), daemon=True)
t2.start()
time.sleep(1)
state2.quit = True
t2.join(timeout=2)
print('  OK: last_result =', state2.last_result)
assert 'HTTP 500' in state2.last_result, f'expected HTTP 500 in result, got {state2.last_result}'

# Test 4b: poll_loop handles a non-JSON 200 (e.g. Vercel function crash)
print('[test] poll_loop on non-JSON 200')
def fake_get_html(url, **kwargs):
    r = MagicMock()
    r.status_code = 200
    r.ok = True
    r.json.side_effect = ValueError('not json')
    r.text = '<html>error</html>'
    return r
requests.get = fake_get_html
state2b = app.State()
t2b = threading.Thread(target=app.poll_loop, args=('https://example.com', cookie, state2b, MagicMock()), daemon=True)
t2b.start()
time.sleep(1)
state2b.quit = True
t2b.join(timeout=2)
print('  OK: last_result =', state2b.last_result)
assert 'non-JSON' in state2b.last_result, f'expected non-JSON in result, got {state2b.last_result}'

# Test 5: poll_loop handles a reminder returned
print('[test] poll_loop on reminder returned')
def fake_get_with_reminder(url, **kwargs):
    r = MagicMock()
    r.status_code = 200
    r.json.return_value = {
        'ok': True,
        'timed_out': False,
        'reminders': [{'id': 42, 'title': 'Test', 'body': 'hello', 'fire_at': '2026-07-24T00:00:00Z'}]
    }
    r.text = json.dumps(r.json.return_value)
    return r
requests.get = fake_get_with_reminder
state3 = app.State()
notifier3 = MagicMock()
t3 = threading.Thread(target=app.poll_loop, args=('https://example.com', cookie, state3, notifier3), daemon=True)
t3.start()
time.sleep(0.5)
state3.quit = True
t3.join(timeout=2)
print('  OK: notifier.send called?', notifier3.send.called)
print('  OK: args =', notifier3.send.call_args)
assert notifier3.send.called, 'notifier.send should have been called'
assert notifier3.send.call_args.kwargs['title'] == 'Test'

print('\n=== All dry-run tests passed ===')
