/* ------------------------------------------
   AXIS // slider.js
   V5 // Small left-edge slider for "today in
   one line". Trigger is a small AXIS reticle
   button on the left edge that travels with
   the panel as it slides in. No nav, no
   modules, just the note. Click the trigger
   again (or Escape, or backdrop) to close.
   ------------------------------------------ */

(function () {
    'use strict';

    const TRIGGER_ID = 'axis-slider-trigger';
    const SLIDER_ID = 'axis-slider';
    const NOTE_ID = 'axis-slider-note';
    const NOTE_KEY = 'axis_today_line';

    function $(id) { return document.getElementById(id); }

    function isOpen() {
        const s = $(SLIDER_ID);
        return !!s && !s.hidden && s.classList.contains('open');
    }

    function open() {
        const s = $(SLIDER_ID);
        const t = $(TRIGGER_ID);
        if (!s) return;
        s.hidden = false;
        // Force reflow so the transition runs from the closed state.
        // eslint-disable-next-line no-unused-expressions
        s.offsetHeight;
        s.classList.add('open');
        if (t) t.setAttribute('aria-expanded', 'true');
        // Focus the textarea so the user can type immediately.
        requestAnimationFrame(() => {
            const note = $(NOTE_ID);
            if (note && document.activeElement === document.body) {
                note.focus({ preventScroll: true });
            }
        });
    }

    function close() {
        const s = $(SLIDER_ID);
        const t = $(TRIGGER_ID);
        if (!s) return;
        s.classList.remove('open');
        if (t) t.setAttribute('aria-expanded', 'false');
        setTimeout(() => {
            if (!s.classList.contains('open')) s.hidden = true;
        }, 300);
    }

    function toggle() {
        if (isOpen()) close();
        else open();
    }

    function bind() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isOpen()) {
                e.stopPropagation();
                close();
            }
        });
    }

    function bindNote() {
        const el = $(NOTE_ID);
        if (!el) return;
        // Hydrate from localStorage.
        try {
            const v = localStorage.getItem(NOTE_KEY);
            if (v != null) el.value = v;
        } catch (_) {}
        // Save on every input.
        el.addEventListener('input', () => {
            try { localStorage.setItem(NOTE_KEY, el.value); } catch (_) {}
        });
    }

    function init() {
        const t = $(TRIGGER_ID);
        if (t) t.setAttribute('aria-expanded', 'false');
        bindNote();
        bind();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.axisSlider = { open, close, toggle, isOpen };
})();
