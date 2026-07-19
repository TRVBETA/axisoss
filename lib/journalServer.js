import { supabaseRequest } from './supabaseServer.js';

function cleanEntryType(type) {
  const allowed = new Set(['thought', 'idea', 'reflection', 'log', 'task-note']);
  const value = String(type || '').trim().toLowerCase();
  return allowed.has(value) ? value : 'thought';
}

function cleanTags(tags) {
  if (Array.isArray(tags)) {
    return tags.map(t => String(t || '').trim()).filter(Boolean).slice(0, 12).join(', ');
  }
  return String(tags || '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)
    .slice(0, 12)
    .join(', ');
}

export async function fetchJournalEntries(limit = 100) {
  const rows = await supabaseRequest(`journal_entries?select=id,content,entry_type,tags,created_at,updated_at&order=created_at.desc&limit=${limit}`);
  return rows || [];
}

export async function createJournalEntry({ content, entryType = 'thought', tags = '' }) {
  const cleanContent = String(content || '').trim();
  if (!cleanContent) throw new Error('JOURNAL CONTENT REQUIRED');
  const rows = await supabaseRequest('journal_entries', {
    method: 'POST',
    body: {
      content: cleanContent,
      entry_type: cleanEntryType(entryType),
      tags: cleanTags(tags),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function deleteJournalEntry(id) {
  await supabaseRequest(`journal_entries?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
  return true;
}