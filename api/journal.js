import { isAuthenticatedRequest } from '../lib/axisAuth.js';
import { createJournalEntry, deleteJournalEntry, fetchJournalEntries } from '../lib/journalServer.js';

export default async function handler(req, res) {
  if (!isAuthenticatedRequest(req)) {
    return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
  }

  if (req.method === 'GET') {
    try {
      const rows = await fetchJournalEntries(120);
      return res.status(200).json({ ok: true, rows });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message || 'FAILED TO LOAD JOURNAL' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD NOT ALLOWED' });
  }

  const action = String(req.body?.action || '').trim().toLowerCase();

  try {
    if (action === 'delete') {
      const id = String(req.body?.id || '').trim();
      if (!id) return res.status(400).json({ ok: false, error: 'ENTRY ID REQUIRED' });
      await deleteJournalEntry(id);
      return res.status(200).json({ ok: true });
    }

    const row = await createJournalEntry({
      content: req.body?.content,
      entryType: req.body?.entryType,
      tags: req.body?.tags
    });
    return res.status(200).json({ ok: true, row });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || 'FAILED TO SAVE JOURNAL ENTRY' });
  }
}