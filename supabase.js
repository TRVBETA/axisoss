/* ------------------------------------------
   AXIS // supabase.js
   Server-managed DB bridge status + local fallback memory.
   Browser no longer stores secret database keys.
   ------------------------------------------ */

let supabaseClient = {
    mode: 'locked', // 'online', 'offline', 'locked'
    lastProbe: null
};

function initSupabase() {
    verifyDatabaseConnection();
}

async function verifyDatabaseConnection() {
    const statusEl = document.getElementById('hud-db-status');

    try {
        if (statusEl) {
            statusEl.textContent = 'PINGING...';
            statusEl.style.color = 'var(--hud-cyan)';
        }

        const resp = await fetch('/api/db-test', {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store'
        });

        const data = await resp.json().catch(() => ({}));

        if (resp.status === 401) {
            setLockedStandby(statusEl);
            return;
        }

        if (!resp.ok || !data.ok) {
            throw new Error(data.error || 'DB bridge rejected');
        }

        supabaseClient.mode = 'online';
        supabaseClient.lastProbe = data.checkedAt || new Date().toISOString();

        if (statusEl) {
            statusEl.textContent = 'ONLINE // VERIFIED';
            statusEl.style.color = 'var(--hud-optimal)';
        }
    } catch (e) {
        supabaseClient.mode = 'offline';
        if (statusEl) {
            statusEl.textContent = 'LOCAL ONLY';
            statusEl.style.color = 'var(--hud-warning)';
        }
    }
}

async function dbExecute(table, method = 'GET', body = null, matchParams = {}) {
    // AXIS is being migrated to server-managed DB routes.
    // Until module-specific server routes are added, keep safe local fallback behavior.
    return dbExecuteLocal(table, method, body, matchParams);
}

function dbExecuteLocal(table, method, body, matchParams) {
    let storageKey = `axis_db_${table}`;
    let data = JSON.parse(localStorage.getItem(storageKey) || '[]');

    if (method === 'GET') {
        if (Object.keys(matchParams).length === 0) return data;
        return data.filter(item => {
            for (let k in matchParams) {
                if (item[k] !== matchParams[k]) return false;
            }
            return true;
        });
    }

    if (method === 'POST') {
        let newRecord = { id: Date.now(), created_at: new Date().toISOString(), ...body };
        data.push(newRecord);
        localStorage.setItem(storageKey, JSON.stringify(data));
        return [newRecord];
    }

    if (method === 'PATCH' || method === 'PUT') {
        let updated = [];
        data = data.map(item => {
            let matches = true;
            for (let k in matchParams) {
                if (item[k] !== matchParams[k]) matches = false;
            }
            if (matches) {
                let rec = { ...item, ...body };
                updated.push(rec);
                return rec;
            }
            return item;
        });
        localStorage.setItem(storageKey, JSON.stringify(data));
        return updated;
    }

    if (method === 'DELETE') {
        data = data.filter(item => {
            for (let k in matchParams) {
                if (item[k] !== matchParams[k]) return true;
            }
            return false;
        });
        localStorage.setItem(storageKey, JSON.stringify(data));
        return [];
    }

    return [];
}

function setLockedStandby(statusEl) {
    supabaseClient.mode = 'locked';
    if (statusEl) {
        statusEl.textContent = 'LOCKED';
        statusEl.style.color = 'var(--text-muted)';
    }
}