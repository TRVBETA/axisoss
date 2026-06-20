import { isAuthenticatedRequest } from './_axisAuth.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ authenticated: false, error: 'METHOD NOT ALLOWED' });
    }

    const authenticated = isAuthenticatedRequest(req);
    return res.status(200).json({ authenticated });
}