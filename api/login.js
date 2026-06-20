import { buildSessionCookie, createSessionToken } from './_axisAuth.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'METHOD NOT ALLOWED' });
    }

    const axisPin = process.env.AXIS_PIN;
    if (!axisPin) {
        return res.status(500).json({ ok: false, error: 'AXIS_PIN NOT SET IN VERCEL ENV' });
    }

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