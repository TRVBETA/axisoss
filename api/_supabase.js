function getSupabaseConfig() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!url || !key) {
        throw new Error('MISSING SUPABASE_URL OR SUPABASE SECRET KEY');
    }

    return { url, key };
}

function buildHeaders(extra = {}) {
    const { key } = getSupabaseConfig();
    return {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        ...extra
    };
}

export async function supabaseRequest(path, options = {}) {
    const { url } = getSupabaseConfig();
    const target = `${url}/rest/v1/${path}`;
    const response = await fetch(target, {
        method: options.method || 'GET',
        headers: options.headers || buildHeaders(),
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    const text = await response.text();
    let data;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = text;
    }

    if (!response.ok) {
        const err = new Error(typeof data === 'string' ? data.slice(0, 300) : JSON.stringify(data).slice(0, 300));
        err.status = response.status;
        err.payload = data;
        err.target = target;
        throw err;
    }

    return data;
}

export function supabaseHeaders(extra = {}) {
    return buildHeaders(extra);
}
