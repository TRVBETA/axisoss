/* ==========================================
   AXIS OS // supabase.js
   All Database & Storage Connection Logic
   Supports real Supabase REST API or seamless LocalStorage Offline Fortress Mode
   ========================================== */

let supabaseClient = {
    url: localStorage.getItem('axis_supabase_url') || '',
    key: localStorage.getItem('axis_supabase_key') || '',
    mode: 'offline', // 'online' or 'offline'
};

function initSupabase() {
    const statusEl = document.getElementById('hud-db-status');
    if (supabaseClient.url && supabaseClient.key) {
        supabaseClient.mode = 'online';
        if (statusEl) {
            statusEl.textContent = 'ONLINE (SUPABASE)';
            statusEl.style.color = 'var(--hud-optimal)';
        }
    } else {
        supabaseClient.mode = 'offline';
        if (statusEl) {
            statusEl.textContent = 'OFFLINE (LOCAL MEMORY)';
            statusEl.style.color = 'var(--hud-warning)';
        }
    }
}

/* Generic REST API Executer to Supabase PostgREST endpoints */
async function dbExecute(table, method = 'GET', body = null, matchParams = {}) {
    if (supabaseClient.mode === 'online') {
        let endpoint = `${supabaseClient.url}/rest/v1/${table}`;
        let headers = {
            'apikey': supabaseClient.key,
            'Authorization': `Bearer ${supabaseClient.key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        };

        // Construct query parameters
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
            if (!resp.ok) throw new Error(`PostgREST Request Failed: ${resp.status}`);
            return await resp.json();
        } catch(e) {
            console.warn('Supabase request failed, falling back to local memory storage', e);
            return dbExecuteLocal(table, method, body, matchParams);
        }
    } else {
        return dbExecuteLocal(table, method, body, matchParams);
    }
}

/* LocalStorage Offline Storage Engine */
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