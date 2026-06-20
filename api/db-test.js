import { isAuthenticatedRequest } from './_axisAuth.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ ok: false, error: 'METHOD NOT ALLOWED' });
    }

    if (!isAuthenticatedRequest(req)) {
        return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !secretKey) {
        return res.status(500).json({
            ok: false,
            error: 'MISSING SUPABASE_URL OR SUPABASE_SECRET_KEY IN VERCEL ENV'
        });
    }

    try {
        const resp = await fetch(`${supabaseUrl}/rest/v1/`, {
            method: 'GET',
            headers: {
                apikey: secretKey,
                Authorization: `Bearer ${secretKey}`
            }
        });

        if (!resp.ok) {
            const text = await resp.text();
            return res.status(resp.status).json({
                ok: false,
                error: `SUPABASE REJECTED REQUEST // ${text.slice(0, 180)}`
            });
        }

        return res.status(200).json({
            ok: true,
            message: 'SUPABASE SERVER BRIDGE VERIFIED',
            checkedAt: new Date().toISOString()
        });
    } catch (e) {
        return res.status(500).json({
            ok: false,
            error: e.message || 'UNKNOWN DB TEST FAILURE'
        });
    }
}