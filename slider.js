/* ------------------------------------------
   AXIS // slider.js
   V5 // Small left-edge slider for "today in
   one line". The textarea is keyed by date;
   a History button reveals past entries as
   small date pills. Click a pill to load that
   day's line back into the editor.
   ------------------------------------------ */

(function () {
    'use strict';

    const TRIGGER_ID = 'axis-slider-trigger';
    const SLIDER_ID = 'axis-slider';
    const NOTE_ID = 'axis-slider-note';
    const EYEBROW_ID = 'axis-slider-eyebrow';
    const HISTORY_BTN_ID = 'axis-slider-history-btn';
    const HISTORY_ID = 'axis-slider-history';
    const HISTORY_LIST_ID = 'axis-slider-history-list';

    const HISTORY_KEY = 'axis_today_history';
    const HISTORY_LIMIT = 30;
    const TODAY_KEY = todayKey();

    let viewingDate = TODAY_KEY;     // which date the textarea is currently showing
    let historyOpen = false;

    function $(id) { return document.getElementById(id); }

    function todayKey() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function loadHistory() {
        try {
            const raw = localStorage.getItem(HISTORY_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return (parsed && typeof parsed === 'object') ? parsed : {};
        } catch (_) {
            return {};
        }
    }

    function saveHistory(map) {
        try {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(map));
        } catch (_) {}
    }

    function pruneHistory(map) {
        const keys = Object.keys(map).sort().reverse();
        if (keys.length <= HISTORY_LIMIT) return map;
        const next = {};
        keys.slice(0, HISTORY_LIMIT).forEach((k) => { next[k] = map[k]; });
        return next;
    }

    function writeCurrentLine(value) {
        const map = loadHistory();
        const trimmed = String(value || '').trim();
        if (trimmed) {
            map[viewingDate] = trimmed;
        } else {
            delete map[viewingDate];
        }
        saveHistory(pruneHistory(map));
    }

    function loadIntoTextarea(dateKey) {
        const map = loadHistory();
        const el = $(NOTE_ID);
        if (!el) return;
        el.value = map[dateKey] || '';
        viewingDate = dateKey;
        updateEyebrow();
    }

    function updateEyebrow() {
        const el = $(EYEBROW_ID);
        if (!el) return;
        el.textContent = viewingDate === TODAY_KEY ? 'Today' : formatDateLabel(viewingDate);
    }

    function formatDateLabel(key) {
        // "2026-07-15" -> "15 JUL"
        const parts = String(key).split('-');
        if (parts.length !== 3) return key;
        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        const day = parseInt(parts[2], 10);
        const month = months[parseInt(parts[1], 10) - 1];
        return `${day} ${month}`;
    }

    function renderHistory() {
        const map = loadHistory();
        const list = $(HISTORY_LIST_ID);
        if (!list) return;
        const keys = Object.keys(map).sort().reverse();
        if (!keys.length) {
            list.innerHTML = `<div class="axis-slider-history-empty">No past entries yet.</div>`;
            return;
        }
        list.innerHTML = keys.map((k) => {
            const active = k === viewingDate;
            const label = k === TODAY_KEY ? 'Today' : formatDateLabel(k);
            const preview = (map[k] || '').slice(0, 60) + (map[k] && map[k].length > 60 ? '…' : '');
            return `
                <button
                    type="button"
                    class="axis-slider-history-item ${active ? 'active' : ''}"
                    data-date="${k}"
                    onclick="window.axisSlider && window.axisSlider.loadDate('${k}')"
                >
                    <span class="axis-slider-history-date">${label}</span>
                    <span class="axis-slider-history-preview">${escapeHtml(preview)}</span>
                </button>
            `;
        }).join('');
    }

    function escapeHtml(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function showHistory() {
        renderHistory();
        const wrap = $(HISTORY_ID);
        const btn = $(HISTORY_BTN_ID);
        if (wrap) wrap.hidden = false;
        if (btn) btn.setAttribute('aria-expanded', 'true');
        historyOpen = true;
    }

    function hideHistory() {
        const wrap = $(HISTORY_ID);
        const btn = $(HISTORY_BTN_ID);
        if (wrap) wrap.hidden = true;
        if (btn) btn.setAttribute('aria-expanded', 'false');
        historyOpen = false;
    }

    function toggleHistory() {
        if (historyOpen) hideHistory();
        else showHistory();
    }

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
        // Always reset to today's view when opening.
        loadIntoTextarea(TODAY_KEY);
        hideHistory();
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
        hideHistory();
        setTimeout(() => {
            if (!s.classList.contains('open')) s.hidden = true;
        }, 300);
    }

    function toggle() {
        if (isOpen()) close();
        else open();
    }

    function loadDate(dateKey) {
        // Persist the line currently in the editor under its current
        // viewingDate before switching.
        const el = $(NOTE_ID);
        if (el) writeCurrentLine(el.value);
        loadIntoTextarea(dateKey);
        if (historyOpen) renderHistory();
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
        el.addEventListener('input', () => {
            writeCurrentLine(el.value);
            if (historyOpen) renderHistory();
        });
    }

    function init() {
        const t = $(TRIGGER_ID);
        if (t) t.setAttribute('aria-expanded', 'false');
        const b = $(HISTORY_BTN_ID);
        if (b) b.setAttribute('aria-expanded', 'false');
        bindNote();
        bind();
        // Pre-hydrate today's value so opening the slider shows
        // the most recently typed line for today.
        loadIntoTextarea(TODAY_KEY);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.axisSlider = {
        open, close, toggle, isOpen,
        toggleHistory, showHistory, hideHistory,
        loadDate
    };
})();
