import { isAuthenticatedRequest } from './_axisAuth.js';
import { clearAllFitnessData } from './_fitnessServer.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'METHOD NOT ALLOWED' });
    }

    if (!isAuthenticatedRequest(req)) {
        return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
    }

    try {
        await clearAllFitnessData();
        return res.status(200).json({ ok: true, message: 'FITNESS DATA CLEARED' });
    } catch (e) {
        return res.status(500).json({ ok: false, error: e.message || 'FAILED TO CLEAR FITNESS DATA' });
    }
}
