/* ------------------------------------------
   AXIS // modals.js
   V5 modal shell + portal. Mounts two modals
   (clipboard + task capture) at the document
   body level so they are not destroyed by
   renderCoreHome() in core.js.

   State and handlers still live in core.js.
   This file only owns: rendering, open/close
   lifecycle, focus trap, scroll lock, escape.
   ------------------------------------------ */

(function () {
    'use strict';

    const MODAL_HOST_ID = 'axis-modal-host';

    function ensureHost() {
        let host = document.getElementById(MODAL_HOST_ID);
        if (!host) {
            host = document.createElement('div');
            host.id = MODAL_HOST_ID;
            host.setAttribute('data-axis-modal-host', '1');
            document.body.appendChild(host);
        }
        return host;
    }

    // Single open modal at a time. Track the trigger that opened it
    // so we can restore focus on close.
    let activeModalId = null;
    let activeTrigger = null;
    let lastFocused = null;

    function trapFocus(modalEl) {
        const focusables = getFocusable(modalEl);
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        modalEl.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab') return;
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        });
    }

    function getFocusable(root) {
        const sel = [
            'a[href]',
            'button:not([disabled])',
            'input:not([disabled]):not([type="hidden"])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"])'
        ].join(',');
        return Array.from(root.querySelectorAll(sel));
    }

    function lockScroll() {
        // Idempotent. If both old and new modal layers touched
        // overflow we may have stale inline styles; just enforce.
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
    }

    function unlockScroll() {
        if (activeModalId) return; // another modal is still open
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
    }

    function renderIntoHost(html) {
        const host = ensureHost();
        host.innerHTML = html;
        return host.firstElementChild;
    }

    function open({ modalId, triggerEl, html, focusSelector }) {
        // Close any existing modal first (single-stack).
        if (activeModalId && activeModalId !== modalId) {
            close({ restoreFocus: false });
        }
        activeModalId = modalId;
        activeTrigger = triggerEl || null;
        lastFocused = document.activeElement;
        lockScroll();
        const node = renderIntoHost(html);
        if (!node) return;
        node.setAttribute('data-axis-modal', modalId);
        node.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                close({ restoreFocus: true });
            }
        });
        trapFocus(node);
        if (focusSelector) {
            requestAnimationFrame(() => {
                const target = node.querySelector(focusSelector);
                if (target) target.focus();
            });
        }
    }

    function close({ restoreFocus = true } = {}) {
        const host = document.getElementById(MODAL_HOST_ID);
        if (host) host.innerHTML = '';
        activeModalId = null;
        unlockScroll();
        const trigger = activeTrigger;
        activeTrigger = null;
        if (restoreFocus && trigger && typeof trigger.focus === 'function') {
            trigger.focus();
        } else if (lastFocused && typeof lastFocused.focus === 'function') {
            lastFocused.focus();
        }
    }

    function isOpen() {
        return activeModalId !== null;
    }

    function activeId() {
        return activeModalId;
    }

    // Backdrop click helper called from inline onclick.
    function backdropClose(event, expectedModalId) {
        if (!event) return;
        if (event.target === event.currentTarget) {
            // Only close if the click landed on the backdrop, not the panel.
            if (!expectedModalId || activeModalId === expectedModalId) {
                close({ restoreFocus: true });
            }
        }
    }

    window.axisModals = {
        open,
        close,
        isOpen,
        activeId,
        backdropClose
    };
})();
