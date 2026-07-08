let notificationsState = {
    rules: JSON.parse(localStorage.getItem('axis_notification_rules') || '[]'),
    draftTitle: '',
    draftMessage: '',
    draftStartAt: '',
    draftRepeatValue: 1,
    draftRepeatUnit: 'hours',
    draftEnabled: true,
    permission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
    isEditing: false,
    syncMode: 'local',
    lastError: ''
};

function initNotifications() {
    renderNotificationsView();
    loadNotificationsFromServer({ silent: true });
}

function renderNotificationsView() {
    const container = document.getElementById('module-notifications');
    if (!container) return;

    container.innerHTML = `
        <div class="cockpit-header">
            <span>NOTIFICATIONS</span>
            <span class="text-sm text-muted">${notificationsState.syncMode === 'server' ? 'SERVER SYNC' : 'LOCAL'}</span>
        </div>

        <section class="grid grid-cols-1 md-grid-cols-2" style="gap: 20px; align-items: start;">
            <div class="cockpit-card stack stack-md">
                <div class="row" style="justify-content: space-between; gap: 12px; flex-wrap: wrap;">
                    <span class="font-mono text-base font-semibold text-accent">SCHEDULE RULE</span>
                    <span class="badge ${notificationsState.permission === 'granted' ? 'badge-optimal' : 'badge-warning'}">${notificationsState.permission.toUpperCase()}</span>
                </div>
                <form onsubmit="handleNotificationRuleSave(event)" class="stack stack-sm">
                    <input class="tactical-input" placeholder="Title" value="${escapeNotificationHtml(notificationsState.draftTitle)}" oninput="updateNotificationDraft('title', this.value)" onfocus="setNotificationsEditing(true)" onblur="setNotificationsEditing(false)">
                    <textarea class="tactical-input" rows="4" placeholder="Message" oninput="updateNotificationDraft('message', this.value)" onfocus="setNotificationsEditing(true)" onblur="setNotificationsEditing(false)">${escapeNotificationHtml(notificationsState.draftMessage)}</textarea>
                    <input type="datetime-local" class="tactical-input" value="${notificationsState.draftStartAt}" oninput="updateNotificationDraft('startAt', this.value)" onfocus="setNotificationsEditing(true)" onblur="setNotificationsEditing(false)">
                    <div class="row flex-wrap" style="gap: 10px; align-items: center;">
                        <label class="badge badge-muted" style="padding: 8px 10px;">
                            Every
                            <input type="number" min="1" step="1" value="${Number(notificationsState.draftRepeatValue || 1)}" class="tactical-input" style="width: 66px; padding: 6px 8px;" oninput="updateNotificationDraft('repeatValue', this.value)" onfocus="setNotificationsEditing(true)" onblur="setNotificationsEditing(false)">
                        </label>
                        <select class="tactical-select" oninput="updateNotificationDraft('repeatUnit', this.value)" onfocus="setNotificationsEditing(true)" onblur="setNotificationsEditing(false)">
                            <option value="minutes" ${notificationsState.draftRepeatUnit === 'minutes' ? 'selected' : ''}>minutes</option>
                            <option value="hours" ${notificationsState.draftRepeatUnit === 'hours' ? 'selected' : ''}>hours</option>
                            <option value="days" ${notificationsState.draftRepeatUnit === 'days' ? 'selected' : ''}>days</option>
                        </select>
                        <label class="badge badge-muted" style="padding: 8px 10px; cursor: pointer;">
                            <input type="checkbox" ${notificationsState.draftEnabled ? 'checked' : ''} onchange="updateNotificationDraft('enabled', this.checked)"> Enabled
                        </label>
                    </div>
                    <div class="row flex-wrap" style="gap: 8px;">
                        <button type="submit" class="tactical-btn">SAVE RULE</button>
                        <button type="button" class="tactical-btn cyan" onclick="requestNotificationPermission()">ALLOW NOTIFICATIONS</button>
                    </div>
                </form>
                <div class="text-sm text-muted font-mono" style="line-height: 1.6; background: rgba(255,255,255,0.03); padding: 12px; border-radius: 10px;">
                    Notifications are browser-based. For desktop alerts, keep AXIS open in the browser and allow site notifications.
                </div>
            </div>

            <div class="cockpit-card stack stack-md">
                <div class="font-mono text-base font-semibold text-main">RULES</div>
                <div class="stack stack-sm">${renderNotificationRulesHTML()}</div>
            </div>
        </section>
    `;
}

function renderNotificationRulesHTML() {
    if (!notificationsState.rules.length) {
        return `<div class="text-sm text-muted font-mono" style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 10px;">No notification rules yet.</div>`;
    }
    return notificationsState.rules.slice(0, 20).map(rule => `
        <div class="list-item" style="align-items: flex-start; gap: 12px;">
            <div class="flex-1" style="min-width: 0;">
                <div class="row flex-wrap" style="gap: 8px; margin-bottom: 6px;">
                    <span class="badge ${rule.enabled ? 'badge-optimal' : 'badge-muted'}">${rule.enabled ? 'ENABLED' : 'DISABLED'}</span>
                    <span class="badge badge-muted">${Number(rule.repeat_value || 1)} ${String(rule.repeat_unit || 'hours').toUpperCase()}</span>
                    <span class="text-sm text-muted font-mono">${formatNotificationTime(rule.start_at)}</span>
                </div>
                <div class="font-mono text-sm font-bold text-main">${escapeNotificationHtml(rule.title)}</div>
                <div class="text-sm text-muted" style="margin-top: 4px; line-height: 1.5; white-space: pre-wrap; word-break: break-word;">${escapeNotificationHtml(rule.message)}</div>
            </div>
            <div class="stack" style="gap: 6px;">
                <button type="button" class="tactical-btn" style="padding: 4px 8px; font-size: 0.62rem;" onclick="prefillNotificationRule('${rule.id}')">EDIT</button>
                <button type="button" class="tactical-btn" style="padding: 4px 8px; font-size: 0.62rem; border-color: var(--hud-critical); color: var(--hud-critical);" onclick="deleteNotificationRuleItem('${rule.id}')">DEL</button>
            </div>
        </div>
    `).join('');
}

function setNotificationsEditing(flag) {
    notificationsState.isEditing = !!flag;
}

function updateNotificationDraft(field, value) {
    notificationsState.isEditing = true;
    if (field === 'title') notificationsState.draftTitle = String(value || '');
    if (field === 'message') notificationsState.draftMessage = String(value || '');
    if (field === 'startAt') notificationsState.draftStartAt = String(value || '');
    if (field === 'repeatValue') notificationsState.draftRepeatValue = Math.max(1, parseInt(value || 1, 10) || 1);
    if (field === 'repeatUnit') notificationsState.draftRepeatUnit = String(value || 'hours');
    if (field === 'enabled') notificationsState.draftEnabled = !!value;
}

async function requestNotificationPermission() {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    notificationsState.permission = result;
    renderNotificationsView();
}

async function loadNotificationsFromServer({ silent = false } = {}) {
    if (!window.axisAuthState?.authenticated || typeof supabaseClient === 'undefined' || supabaseClient.mode !== 'online') return false;
    try {
        const resp = await fetch('/api/notifications', { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        notificationsState.rules = data.rows || [];
        notificationsState.syncMode = 'server';
        notificationsState.lastError = '';
        localStorage.setItem('axis_notification_rules', JSON.stringify(notificationsState.rules));
        if (!(silent && notificationsState.isEditing)) renderNotificationsView();
        return true;
    } catch (e) {
        notificationsState.syncMode = 'local';
        notificationsState.lastError = e.message || 'FAILED TO LOAD NOTIFICATIONS';
        return false;
    }
}

async function handleNotificationRuleSave(e) {
    e.preventDefault();
    if (!window.axisAuthState?.authenticated || typeof supabaseClient === 'undefined' || supabaseClient.mode !== 'online') return;

    const payload = {
        title: notificationsState.draftTitle,
        message: notificationsState.draftMessage,
        startAt: notificationsState.draftStartAt || new Date().toISOString().slice(0, 16),
        repeatValue: notificationsState.draftRepeatValue,
        repeatUnit: notificationsState.draftRepeatUnit,
        enabled: notificationsState.draftEnabled
    };

    try {
        const action = notificationsState.editingId ? 'update' : 'create';
        const resp = await fetch('/api/notifications', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: action === 'update' ? 'update' : '', id: notificationsState.editingId, ...payload })
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        notificationsState.draftTitle = '';
        notificationsState.draftMessage = '';
        notificationsState.draftStartAt = '';
        notificationsState.draftRepeatValue = 1;
        notificationsState.draftRepeatUnit = 'hours';
        notificationsState.draftEnabled = true;
        notificationsState.editingId = null;
        notificationsState.isEditing = false;
        await loadNotificationsFromServer({ silent: false });
    } catch (e) {
        console.warn(`Notification save failed: ${e.message}`);
    }
}

function prefillNotificationRule(id) {
    const rule = notificationsState.rules.find(r => r.id === id);
    if (!rule) return;
    notificationsState.editingId = id;
    notificationsState.draftTitle = rule.title || '';
    notificationsState.draftMessage = rule.message || '';
    notificationsState.draftStartAt = String(rule.start_at || '').slice(0, 16);
    notificationsState.draftRepeatValue = Number(rule.repeat_value || 1);
    notificationsState.draftRepeatUnit = String(rule.repeat_unit || 'hours');
    notificationsState.draftEnabled = !!rule.enabled;
    renderNotificationsView();
}

async function deleteNotificationRuleItem(id) {
    try {
        const resp = await fetch('/api/notifications', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', id })
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        notificationsState.rules = notificationsState.rules.filter(r => r.id !== id);
        renderNotificationsView();
    } catch (e) {
        console.warn(`Notification delete failed: ${e.message}`);
    }
}

function evaluateNotificationRule(rule) {
    if (!rule.enabled) return false;
    const now = Date.now();
    const startAt = new Date(rule.start_at).getTime();
    if (!Number.isFinite(startAt) || now < startAt) return false;

    const lastFired = rule.last_fired_at ? new Date(rule.last_fired_at).getTime() : null;
    const repeatValue = Math.max(1, Number(rule.repeat_value || 1));
    const unit = String(rule.repeat_unit || 'hours');
    let intervalMs = 60 * 60 * 1000;
    if (unit === 'minutes') intervalMs = repeatValue * 60 * 1000;
    else if (unit === 'hours') intervalMs = repeatValue * 60 * 60 * 1000;
    else if (unit === 'days') intervalMs = repeatValue * 24 * 60 * 60 * 1000;

    if (lastFired === null) return true;
    return now - lastFired >= intervalMs;
}

async function processNotificationRules() {
    if (typeof Notification === 'undefined') return;
    notificationsState.permission = Notification.permission;
    if (Notification.permission !== 'granted') return;
    for (const rule of notificationsState.rules) {
        if (!evaluateNotificationRule(rule)) continue;
        try {
            new Notification(rule.title || 'AXIS', {
                body: rule.message || 'Reminder from AXIS',
                tag: `axis-rule-${rule.id}`,
                renotify: false
            });
            await fetch('/api/notifications', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'mark-fired', id: rule.id, firedAt: new Date().toISOString() })
            });
            rule.last_fired_at = new Date().toISOString();
        } catch (e) {
            console.warn('Notification dispatch failed:', e.message || e);
        }
    }
}

function refreshNotificationsView() {
    if (notificationsState.isEditing) return;
    renderNotificationsView();
}

function formatNotificationTime(value) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return 'INVALID DATE';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month} ${h}:${m}`;
}

function escapeNotificationHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
