/* ==========================================
   AXIS // supabase.js
   PostgREST API Client & Introspection Verification Ping
   ========================================== */

let supabaseClient = {
    url: localStorage.getItem('axis_supabase_url') || 'https://dwceujtyrsfnwsxuaowg.supabase.co',
    key: localStorage.getItem('axis_supabase_key') || 'sb_secret_RFJYtEjmivuBbs_TJ7NukQ_sToTJysG',
    mode: 'offline', // 'online' or 'offline'
};

function initSupabase() {
    verifyDatabaseConnection();
}

async function verifyDatabaseConnection() {
    const statusEl = document.getElementById('hud-db-status');
    if (!supabaseClient.url || !supabaseClient.key) {
        setLocalStandby(statusEl);
        return;
    }

    try {
        if (statusEl) {
            statusEl.textContent = 'PINGING...';
            statusEl.style.color = 'var(--hud-cyan)';
        }

        let resp = await fetch(`${supabaseClient.url}/rest/v1/`, {
            method: 'GET',
            headers: {
                'apikey': supabaseClient.key,
                'Authorization': `Bearer ${supabaseClient.key}`,
                'Content-Type': 'application/json'
            },
            timeout: 6000
        });

        if (resp.ok) {
            supabaseClient.mode = 'online';
            if (statusEl) {
                statusEl.textContent = 'ONLINE // VERIFIED';
                statusEl.style.color = 'var(--hud-optimal)';
            }
        } else {
            throw new Error('Key rejected');
        }
    } catch (e) {
        supabaseClient.mode = 'offline';
        if (statusEl) {
            statusEl.textContent = 'FAULT // MOCK MEMORY';
            statusEl.style.color = 'var(--hud-critical)';
        }
    }
}

async function dbExecute(table, method = 'GET', body = null, matchParams = {}) {
    if (supabaseClient.mode === 'online') {
        let endpoint = `${supabaseClient.url}/rest/v1/${table}`;
        let headers = {
            'apikey': supabaseClient.key,
            'Authorization': `Bearer ${supabaseClient.key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        };

        let queryParts = [];
        if (method === 'GET' && Object.keys(matchParams).length > 0) {
            for (let k in matchParams) {
                queryParts.push(`${encodeURIComponent(k)}=eq.${encodeURIComponent(matchParams[k])}`);
            }
        }
        if (queryParts.length > 0) endpoint += `?${queryParts.join('&')}`;

        try {
            let options = { method, headers };
            if (body) options.body = JSON.stringify(body);

            let resp = await fetch(endpoint, options);
            if (!resp.ok) throw new Error(`DB fail: ${resp.status}`);
            return await resp.json();
        } catch(e) {
            return dbExecuteLocal(table, method, body, matchParams);
        }
    } else {
        return dbExecuteLocal(table, method, body, matchParams);
    }
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
                if (item[k] === matchParams[k]) return false;
            }
            return true;
        });
        localStorage.setItem(storageKey, JSON.stringify(data));
        return [];
    }

    return [];
}

function setLocalStandby(statusEl) {
    supabaseClient.mode = 'offline';
    if (statusEl) {
        statusEl.textContent = 'STANDBY // LOCAL MEMORY';
        statusEl.style.color = 'var(--text-muted)';
    }
}