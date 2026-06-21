import { isAuthenticatedRequest } from './_axisAuth.js';
import { writeWorkoutSession } from './_fitnessServer.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'METHOD NOT ALLOWED' });
    }

    if (!isAuthenticatedRequest(req)) {
        return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
    }

    const splitName = String(req.body?.splitName || '').trim();
    const loggedAt = req.body?.loggedAt || null;
    const exercises = Array.isArray(req.body?.exercises) ? req.body.exercises : [];

    if (!exercises.length) {
        return res.status(400).json({ ok: false, error: 'NO EXERCISES PROVIDED' });
    }

    try {
        const result = await writeWorkoutSession({
            splitName,
            exercises,
            loggedAt
        });

        return res.status(200).json({
            ok: true,
            splitName: result.splitName,
            exerciseCount: result.exerciseCount,
            setCount: result.setCount
        });
    } catch (e) {
        return res.status(500).json({
            ok: false,
            error: e.message || 'FAILED TO WRITE FITNESS SESSION'
        });
    }
}