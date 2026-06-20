import crypto from 'crypto';

const COOKIE_NAME = 'axis_session';
const DEFAULT_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function getSessionSecret() {
    return process.env.SESSION_SECRET || 'axis-dev-session-secret-change-me';
}

function base64url(input) {
    return Buffer.from(input).toString('base64url');
}

function sign(payload) {
    return crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
}

export function createSessionToken() {
    const payload = JSON.stringify({
        axis: true,
        exp: Math.floor(Date.now() / 1000) + DEFAULT_MAX_AGE
    });
    const encoded = base64url(payload);
    const signature = sign(encoded);
    return `${encoded}.${signature}`;
}

export function verifySessionToken(token) {
    if (!token || !token.includes('.')) return false;
    const [encoded, signature] = token.split('.');
    if (!encoded || !signature) return false;

    const expected = sign(encoded);
    try {
        const validSig = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
        if (!validSig) return false;
    } catch {
        return false;
    }

    try {
        const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
        if (!decoded.axis) return false;
        if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) return false;
        return true;
    } catch {
        return false;
    }
}

export function parseCookies(req) {
    const cookieHeader = req.headers.cookie || '';
    return Object.fromEntries(
        cookieHeader
            .split(';')
            .map(part => part.trim())
            .filter(Boolean)
            .map(part => {
                const eq = part.indexOf('=');
                if (eq === -1) return [part, ''];
                return [part.slice(0, eq), decodeURIComponent(part.slice(eq + 1))];
            })
    );
}

export function isAuthenticatedRequest(req) {
    const cookies = parseCookies(req);
    return verifySessionToken(cookies[COOKIE_NAME]);
}

export function buildSessionCookie(token) {
    return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${DEFAULT_MAX_AGE}`;
}

export function buildLogoutCookie() {
    return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`;
}
