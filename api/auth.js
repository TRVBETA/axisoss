import { buildLogoutCookie, buildSessionCookie, createSessionToken, isAuthenticatedRequest } from '../lib/axisAuth.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ authenticated: isAuthenticatedRequest(req) });
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
  const axisLoginName = String(process.env.AXIS_LOGIN_NAME || '').trim().toLowerCase();
  if (!axisPin) {
    return res.status(500).json({ ok: false, error: 'AXIS_PIN NOT SET IN VERCEL ENV' });
  }

  const name = String(req.body?.name || '').trim();
  const pin = String(req.body?.pin || '').trim();
  if (!name) {
    return res.status(400).json({ ok: false, error: 'IDENTIFIER REQUIRED' });
  }
  if (!pin) {
    return res.status(400).json({ ok: false, error: 'PIN REQUIRED' });
  }

  if (axisLoginName && name.toLowerCase() !== axisLoginName) {
    return res.status(401).json({ ok: false, error: 'ACCESS DENIED // INVALID IDENTIFIER' });
  }

  if (pin !== axisPin) {
    return res.status(401).json({ ok: false, error: 'ACCESS DENIED // INVALID PIN' });
  }

  const token = createSessionToken();
  res.setHeader('Set-Cookie', buildSessionCookie(token));
  return res.status(200).json({ ok: true, message: 'ACCESS GRANTED' });
}