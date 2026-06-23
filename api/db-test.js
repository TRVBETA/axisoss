import { isAuthenticatedRequest } from '../lib/axisAuth.js';

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

    let parsedUrl;
    try {
        parsedUrl = new URL(supabaseUrl);
    } catch {
        return res.status(500).json({
            ok: false,
            error: `SUPABASE_URL IS NOT A VALID ABSOLUTE URL // GOT: ${String(supabaseUrl).slice(0, 120)}`
        });
    }

    if (!parsedUrl.hostname.endsWith('.supabase.co')) {
        return res.status(500).json({
            ok: false,
            error: `SUPABASE_URL DOES NOT LOOK LIKE A SUPABASE PROJECT URL // HOST: ${parsedUrl.hostname}`
        });
    }

    try {
        const targetUrl = `${parsedUrl.origin}/rest/v1/`;
        const resp = await fetch(targetUrl, {
            method: 'GET',
            headers: {
                apikey: secretKey,
                Authorization: `Bearer ${secretKey}`
            }
        });

        if (!resp.ok) {
            const contentType = resp.headers.get('content-type') || 'unknown';
            const text = await resp.text();
            const snippet = text.replace(/\s+/g, ' ').slice(0, 180);

            if (contentType.includes('text/html')) {
                return res.status(resp.status).json({
                    ok: false,
                    error: `SUPABASE REQUEST RETURNED HTML INSTEAD OF API RESPONSE // CHECK SUPABASE_URL // HOST: ${parsedUrl.hostname}`,
                    debug: {
                        targetUrl,
                        status: resp.status,
                        contentType,
                        snippet
                    }
                });
            }

            return res.status(resp.status).json({
                ok: false,
                error: `SUPABASE REJECTED REQUEST`,
                debug: {
                    targetUrl,
                    status: resp.status,
                    contentType,
                    snippet
                }
            });
        }

        return res.status(200).json({
            ok: true,
            message: 'SUPABASE SERVER BRIDGE VERIFIED',
            checkedAt: new Date().toISOString(),
            host: parsedUrl.hostname
        });
    } catch (e) {
        return res.status(500).json({
            ok: false,
            error: e.message || 'UNKNOWN DB TEST FAILURE'
        });
    }
}