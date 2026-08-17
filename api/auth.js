import { buildLogoutCookie, buildSessionCookie, createSessionToken, isAuthenticatedRequest } from '../lib/axisAuth.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const authenticated = isAuthenticatedRequest(req);

    // Optional Supabase connectivity probe. Folded into this route from the
    // removed /api/db-test so the deployment stays within the 12-function
    // Hobby-plan limit. Only the ?probe=1 path touches Supabase; a plain GET
    // keeps its original behavior and cost.
    if (req.query?.probe) {
      if (!authenticated) {
        return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
      }

      const supabaseUrl = process.env.SUPABASE_URL;
      const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

      if (!supabaseUrl || !secretKey) {
        return res.status(500).json({ ok: false, error: 'MISSING SUPABASE_URL OR SUPABASE_SECRET_KEY IN VERCEL ENV' });
      }

      let parsedUrl;
      try {
        parsedUrl = new URL(supabaseUrl);
      } catch {
        return res.status(500).json({ ok: false, error: `SUPABASE_URL IS NOT A VALID ABSOLUTE URL // GOT: ${String(supabaseUrl).slice(0, 120)}` });
      }

      if (!parsedUrl.hostname.endsWith('.supabase.co')) {
        return res.status(500).json({ ok: false, error: `SUPABASE_URL DOES NOT LOOK LIKE A SUPABASE PROJECT URL // HOST: ${parsedUrl.hostname}` });
      }

      try {
        const targetUrl = `${parsedUrl.origin}/rest/v1/`;
        const resp = await fetch(targetUrl, {
          method: 'GET',
          headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}` },
        });

        if (!resp.ok) {
          const contentType = resp.headers.get('content-type') || 'unknown';
          const text = await resp.text();
          const snippet = text.replace(/\s+/g, ' ').slice(0, 180);
          const error = contentType.includes('text/html')
            ? `SUPABASE REQUEST RETURNED HTML INSTEAD OF API RESPONSE // CHECK SUPABASE_URL // HOST: ${parsedUrl.hostname}`
            : 'SUPABASE REJECTED REQUEST';
          return res.status(resp.status).json({ ok: false, error, debug: { targetUrl, status: resp.status, contentType, snippet } });
        }

        return res.status(200).json({
          ok: true,
          authenticated: true,
          message: 'SUPABASE SERVER BRIDGE VERIFIED',
          checkedAt: new Date().toISOString(),
          host: parsedUrl.hostname,
        });
      } catch (e) {
        return res.status(500).json({ ok: false, error: e.message || 'UNKNOWN DB TEST FAILURE' });
      }
    }

    return res.status(200).json({ authenticated });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD NOT ALLOWED' });
  }

  const action = String(req.body?.action || '').trim().toLowerCase();

  if (action === 'logout') {
    res.setHeader('Set-Cookie', buildLogoutCookie());
    return res.status(200).json({ ok: true, message: 'LOGGED OUT' });
  }

  if (action !== 'login') {
    return res.status(400).json({ ok: false, error: 'INVALID AUTH ACTION' });
  }

  const axisPin = process.env.AXIS_PIN;
  if (!axisPin) {
    return res.status(500).json({ ok: false, error: 'AXIS_PIN NOT SET IN VERCEL ENV' });
  }

  // Single-user system (PROTOCOL 6). The login screen is one field:
  // the PIN. No identifier required. The 'name' field in the
  // request body is accepted but ignored for backward compatibility.
  const pin = String(req.body?.pin || '').trim();
  if (!pin) {
    return res.status(400).json({ ok: false, error: 'PIN REQUIRED' });
  }

  if (pin !== axisPin) {
    return res.status(401).json({ ok: false, error: 'ACCESS DENIED // INVALID PIN' });
  }

  const token = createSessionToken();
  res.setHeader('Set-Cookie', buildSessionCookie(token));
  return res.status(200).json({ ok: true, message: 'ACCESS GRANTED' });
}