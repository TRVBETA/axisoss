let journalState = {
    entries: JSON.parse(localStorage.getItem('axis_journal_entries') || '[]'),
    draftContent: localStorage.getItem('axis_journal_draft_content') || '',
    draftType: localStorage.getItem('axis_journal_draft_type') || 'thought',
    draftTags: localStorage.getItem('axis_journal_draft_tags') || '',
    syncMode: 'local',
    lastError: '',
    isEditing: false,
    filterType: 'all'
};

function initJournal() {
    renderJournalView();
    loadJournalFromServer({ silent: true });
}

function renderJournalView() {
    const container = document.getElementById('module-journal');
    if (!container) return;

    const filtered = getFilteredJournalEntries();

    container.innerHTML = `
        <div class="cockpit-header">
            <span>JOURNAL</span>
            <span class="text-sm text-muted">${journalState.syncMode === 'server' ? 'SERVER SYNC' : 'LOCAL / DRAFT SAFE'}</span>
        </div>

        <section class="grid grid-cols-1 md:grid-cols-2" style="gap: 20px; align-items: start;">
            <div class="cockpit-card stack stack-md">
                <div class="font-mono text-base font-semibold text-accent">QUICK ENTRY</div>
                <form onsubmit="handleJournalSave(event)" class="stack stack-sm">
                    <div class="row flex-wrap" style="gap: 8px;">
                        ${['thought', 'idea', 'reflection', 'log', 'task-note'].map(type => `
                            <button type="button" class="tactical-btn ${journalState.draftType === type ? 'active' : ''}" style="padding: 6px 10px; font-size: 0.68rem;" onclick="setJournalDraftType('${type}')">${type.toUpperCase()}</button>
                        `).join('')}
                    </div>
                    <textarea id="journal-entry-input" class="tactical-input w-full" rows="8" placeholder="Quick thoughts, ideas, logs, reflections..." onfocus="setJournalEditing(true)" onblur="setJournalEditing(false)" oninput="updateJournalDraft(this.value)">${escapeJournalHtml(journalState.draftContent)}</textarea>
                    <input id="journal-tags-input" class="tactical-input w-full" placeholder="Tags (comma separated)" value="${escapeJournalHtml(journalState.draftTags)}" onfocus="setJournalEditing(true)" onblur="setJournalEditing(false)" oninput="updateJournalDraftTags(this.value)">
                    <button type="submit" class="tactical-btn w-full" style="justify-content: center;">SAVE ENTRY</button>
                </form>
            </div>

            <div class="cockpit-card stack stack-md">
                <div class="row flex-wrap" style="justify-content: space-between; gap: 12px;">
                    <span class="font-mono text-base font-semibold text-main">STREAM</span>
                    <select class="tactical-select" style="min-width: 150px;" onchange="setJournalFilter(this.value)">
                        <option value="all" ${journalState.filterType === 'all' ? 'selected' : ''}>ALL TYPES</option>
                        <option value="thought" ${journalState.filterType === 'thought' ? 'selected' : ''}>THOUGHT</option>
                        <option value="idea" ${journalState.filterType === 'idea' ? 'selected' : ''}>IDEA</option>
                        <option value="reflection" ${journalState.filterType === 'reflection' ? 'selected' : ''}>REFLECTION</option>
                        <option value="log" ${journalState.filterType === 'log' ? 'selected' : ''}>LOG</option>
                        <option value="task-note" ${journalState.filterType === 'task-note' ? 'selected' : ''}>TASK-NOTE</option>
                    </select>
                </div>
                <div class="stack stack-sm">${renderJournalEntriesHTML(filtered)}</div>
            </div>
        </section>
    `;
}

function renderJournalEntriesHTML(entries) {
    if (!entries.length) {
        return `<div class="text-sm text-muted font-mono" style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 16px;">No journal entries yet.</div>`;
    }
    return entries.slice(0, 24).map(entry => `
        <div class="list-item" style="align-items: flex-start; gap: 12px;">
            <div class="flex-1" style="min-width: 0;">
                <div class="row flex-wrap" style="gap: 8px; margin-bottom: 6px;">
                    <span class="badge badge-accent">${String(entry.entry_type || 'thought').toUpperCase()}</span>
                    ${entry.tags ? `<span class="badge badge-muted">${escapeJournalHtml(entry.tags)}</span>` : ''}
                    <span class="text-sm text-muted font-mono">${formatJournalTime(entry.created_at)}</span>
                </div>
                <div style="font-size: 0.9rem; color: var(--text-main); line-height: 1.6; white-space: pre-wrap; word-break: break-word;">${escapeJournalHtml(entry.content)}</div>
            </div>
            <button type="button" class="tactical-btn" style="padding: 4px 8px; font-size: 0.62rem; border-color: var(--hud-critical); color: var(--hud-critical); flex-shrink: 0;" onclick="deleteJournalEntryItem('${entry.id}')">DEL</button>
        </div>
    `).join('');
}

function getFilteredJournalEntries() {
    if (journalState.filterType === 'all') return journalState.entries;
    return journalState.entries.filter(entry => entry.entry_type === journalState.filterType);
}

function setJournalFilter(value) {
    journalState.filterType = value;
    renderJournalView();
}

function setJournalDraftType(type) {
    journalState.draftType = type;
    localStorage.setItem('axis_journal_draft_type', type);
    renderJournalView();
}

function updateJournalDraft(value) {
    journalState.isEditing = true;
    journalState.draftContent = String(value || '');
    localStorage.setItem('axis_journal_draft_content', journalState.draftContent);
}

function updateJournalDraftTags(value) {
    journalState.isEditing = true;
    journalState.draftTags = String(value || '');
    localStorage.setItem('axis_journal_draft_tags', journalState.draftTags);
}

function setJournalEditing(flag) {
    journalState.isEditing = !!flag;
}

async function loadJournalFromServer({ silent = false } = {}) {
    if (!window.axisAuthState?.authenticated || typeof supabaseClient === 'undefined' || supabaseClient.mode !== 'online') return false;
    try {
        const resp = await fetch('/api/journal', { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        journalState.entries = data.rows || [];
        journalState.syncMode = 'server';
        journalState.lastError = '';
        localStorage.setItem('axis_journal_entries', JSON.stringify(journalState.entries));
        if (!(silent && journalState.isEditing)) renderJournalView();
        return true;
    } catch (e) {
        journalState.syncMode = 'local';
        journalState.lastError = e.message || 'FAILED TO LOAD JOURNAL';
        return false;
    }
}

async function handleJournalSave(e) {
    e.preventDefault();
    const content = String(journalState.draftContent || '').trim();
    const tags = String(journalState.draftTags || '').trim();
    if (!content) return;

    if (!window.axisAuthState?.authenticated || typeof supabaseClient === 'undefined' || supabaseClient.mode !== 'online') {
        console.warn('Journal needs online server sync.');
        return;
    }

    try {
        const resp = await fetch('/api/journal', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content,
                entryType: journalState.draftType,
                tags
            })
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        journalState.draftContent = '';
        journalState.draftTags = '';
        journalState.isEditing = false;
        localStorage.removeItem('axis_journal_draft_content');
        localStorage.removeItem('axis_journal_draft_tags');
        await loadJournalFromServer({ silent: false });
    } catch (e) {
        console.warn(`Journal save failed: ${e.message}`);
    }
}

async function deleteJournalEntryItem(id) {
    try {
        const resp = await fetch('/api/journal', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', id })
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        journalState.entries = journalState.entries.filter(entry => entry.id !== id);
        renderJournalView();
    } catch (e) {
        console.warn(`Journal delete failed: ${e.message}`);
    }
}

function refreshJournalView() {
    if (journalState.isEditing) return;
    renderJournalView();
}

function formatJournalTime(value) {
    const d = new Date(value);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month} ${h}:${m}`;
}

function escapeJournalHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
