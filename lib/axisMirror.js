// AXIS Mirror — behaviour observatory.
// Measures how the user shows up on the site and speaks to them when they drift.
// Pure client-side. No network. No tracking. Everything stays in the browser.
// The module is opt-in: it only observes, it never acts without the user choosing.

(function () {
  'use strict';

  const STORAGE_KEY = 'axisMirrorState';
  const MIN_INTERVAL_MS = 5 * 60 * 1000; // don't speak more than once per 5 min
  const IDLE_WARN_MS = 40 * 60 * 1000;   // 40 min of nothing -> nudge

  // Signals the mirror watches, each with a weight toward "are you here".
  const SIGNALS = {
    click: 1,
    keypress: 1,
    scroll: 1,
    focus: 1,
    nav: 2
  };

  let state = loadState();
  let lastSpoke = 0;
  let timer = null;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return { seen: {}, streak: 0, lastDay: null };
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  function todayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function recordSignal(name) {
    const now = Date.now();
    const day = todayKey();
    if (state.lastDay && state.lastDay !== day) {
      state.streak = 0;
    }
    state.lastDay = day;
    const entry = state.seen[day] || { signals: 0, last: 0 };
    entry.signals += SIGNALS[name] || 1;
    entry.last = now;
    state.seen[day] = entry;
    saveState();
  }

  function activeToday() {
    const entry = state.seen[todayKey()];
    return !!(entry && entry.signals > 0);
  }

  function speak(message, opts = {}) {
    const now = Date.now();
    if (now - lastSpoke < MIN_INTERVAL_MS && !opts.force) return;
    lastSpoke = now;
    if (typeof window.axisMirrorOnSpeak === 'function') {
      window.axisMirrorOnSpeak(message, opts);
    }
  }

  function pickMessage() {
    const hour = new Date().getHours();
    const messages = [
      'You built this for a reason. What is it?',
      'The bigger picture is still there. Look up.',
      'What would make today worth it, just a little?',
      'You do not have to be perfect. You just have to show up.',
      'One small thing. Then stop.'
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }

  function checkIdle() {
    const entry = state.seen[todayKey()];
    if (!entry) return;
    const idleMs = Date.now() - entry.last;
    if (idleMs >= IDLE_WARN_MS) {
      speak(pickMessage(), { kind: 'idle' });
    }
  }

  function onSignal(name) {
    recordSignal(name);
    if (timer) clearTimeout(timer);
    timer = setTimeout(checkIdle, IDLE_WARN_MS);
  }

  function init() {
    if (window.axisMirrorReady) return;
    window.axisMirrorReady = true;
    ['click', 'keydown', 'scroll', 'focus'].forEach(ev => {
      document.addEventListener(ev, () => onSignal(ev), { passive: true });
    });
    // Module switches are a stronger signal than a click — they mean intent.
    // switchModule() in index.html dispatches 'axis:nav' on every switch.
    window.addEventListener('axis:nav', () => onSignal('nav'));
  }

  function speakNow(opts) { return speak(pickMessage(), opts); }

  window.axisMirror = { init, speakNow, activeToday, getState: () => state };
})();