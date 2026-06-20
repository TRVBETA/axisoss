import { buildLogoutCookie } from './_axisAuth.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'METHOD NOT ALLOWED' });
    }

    res.setHeader('Set-Cookie', buildLogoutCookie());
    return res.status(200).json({ ok: true, message: 'LOGGED OUT' });
}