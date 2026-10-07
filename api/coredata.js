import { isAuthenticatedRequest } from '../lib/axisAuth.js';
import {
  clearCompletedTodos,
  completeMilestone,
  createMilestone,
  createTodo,
  deleteAxisMarker,
  deleteMilestone,
  deleteTodo,
  fetchCoreData,
  fetchTaskHistory,
  fetchWeeklyReviewSummary,
  renameMilestone,
  saveAxisMarker,
  setMilestoneNote,
  toggleAxisMarkerDone,
  toggleTodo,
  uncompleteMilestone,
  updateBalance,
  updateRank
} from '../lib/coreDataServer.js';
import { getDailyTelemetry } from '../lib/dailyServer.js';
import { fetchFitnessFeed } from '../lib/fitnessServer.js';
import { fetchNutritionSummary } from '../lib/nutritionServer.js';
import { fetchJournalEntries } from '../lib/journalServer.js';
import { supabaseRequest } from '../lib/supabaseServer.js';
import { loadHandoffState } from './sleep.js';

// Consolidated sync: one request carries every module's payload. Runs the
// per-module fetches in parallel; a failing module degrades to null instead
// of failing the whole response (the client applies whatever is present).
async function handleSyncDelta(_req, res) {
  const jobDefs = {
    daily: async () => ({ row: await getDailyTelemetry() }),
    core: async () => {
      const data = await fetchCoreData();
      const history = await fetchTaskHistory(120);
      const review = await fetchWeeklyReviewSummary();
      return { ...data, history, review };
    },
    clipboard: async () => ({
      rows: await supabaseRequest('clipboard_items?select=id,content,source,created_at&order=created_at.desc&limit=20')
    }),
    nutrition: async () => fetchNutritionSummary(),
    fitness: async () => fetchFitnessFeed(),
    sleep: async () => ({ handoff: await loadHandoffState() }),
    library: async () => ({
      rows: await supabaseRequest('library_books?select=id,title,author,book_type,curr_page,total_pages,carry_forward,storage_path,location_cfi,created_at&order=created_at.desc&limit=100')
        .catch((err) => {
          if (/location_cfi|column/i.test(String(err?.message || ''))) {
            return supabaseRequest('library_books?select=id,title,author,book_type,curr_page,total_pages,carry_forward,storage_path,created_at&order=created_at.desc&limit=100');
          }
          throw err;
        })
    }),
    journal: async () => ({ rows: await fetchJournalEntries(120) })
  };

  const keys = Object.keys(jobDefs);
  const results = await Promise.allSettled(keys.map((key) => jobDefs[key]()));
  const payload = { ok: true };
  const errors = {};
  keys.forEach((key, idx) => {
    const result = results[idx];
    payload[key] = result.status === 'fulfilled' ? result.value : null;
    if (result.status === 'rejected') errors[key] = String(result.reason?.message || result.reason || 'FAILED');
  });
  if (Object.keys(errors).length) payload.errors = errors;
  return res.status(200).json(payload);
}

export default async function handler(req, res) {
  if (!isAuthenticatedRequest(req)) {
    return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
  }

  if (req.method === 'GET') {
    if (String(req.query?.action || '') === 'sync-delta') {
      return handleSyncDelta(req, res);
    }
    try {
      const includeReview = String(req.query?.review || '') === '1';
      const data = await fetchCoreData();
      const history = await fetchTaskHistory(120);
      const review = includeReview ? await fetchWeeklyReviewSummary() : null;
      return res.status(200).json({ ok: true, ...data, history, review });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message || 'FAILED TO LOAD CORE DATA' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD NOT ALLOWED' });
  }

  const action = String(req.body?.action || '').trim().toLowerCase();

  try {
    if (action === 'balance') {
      const row = await updateBalance({
        id: req.body?.id,
        label: req.body?.label,
        amount: req.body?.amount
      });
      return res.status(200).json({ ok: true, row });
    }

    if (action === 'todo-add') {
      const row = await createTodo({
        title: req.body?.title,
        isDaily: !!req.body?.isDaily,
        points: req.body?.points,
        taskKind: req.body?.taskKind,
        mode: req.body?.mode,
        impact: req.body?.impact,
        resistance: req.body?.resistance,
        depth: req.body?.depth,
        doneDefinition: req.body?.doneDefinition,
        incomingCritical: !!req.body?.incomingCritical
      });
      return res.status(200).json({ ok: true, row });
    }

    if (action === 'todo-toggle') {
      const row = await toggleTodo(String(req.body?.id || ''), !!req.body?.isDone);
      return res.status(200).json({ ok: true, row });
    }

    if (action === 'todo-delete') {
      await deleteTodo(String(req.body?.id || ''));
      return res.status(200).json({ ok: true });
    }

    if (action === 'todo-clear-done') {
      await clearCompletedTodos();
      return res.status(200).json({ ok: true });
    }

    if (action === 'marker-save') {
      const row = await saveAxisMarker({
        id: req.body?.id,
        title: req.body?.title,
        markerType: req.body?.markerType,
        targetDate: req.body?.targetDate,
        note: req.body?.note,
        isDone: !!req.body?.isDone
      });
      return res.status(200).json({ ok: true, row });
    }

    if (action === 'marker-toggle') {
      const row = await toggleAxisMarkerDone(String(req.body?.id || ''), !!req.body?.isDone);
      return res.status(200).json({ ok: true, row });
    }

    if (action === 'marker-delete') {
      await deleteAxisMarker(String(req.body?.id || ''));
      return res.status(200).json({ ok: true });
    }

    if (action === 'rank-update') {
      const row = await updateRank(Number(req.body?.level), {
        name: req.body?.name,
        shortLabel: req.body?.shortLabel,
        minCount: req.body?.minCount
      });
      return res.status(200).json({ ok: true, row });
    }

    if (action === 'milestone-create') {
      const row = await createMilestone(req.body?.title);
      return res.status(200).json({ ok: true, row });
    }

    if (action === 'milestone-rename') {
      const row = await renameMilestone(String(req.body?.id || ''), req.body?.title);
      return res.status(200).json({ ok: true, row });
    }

    if (action === 'milestone-note') {
      const row = await setMilestoneNote(String(req.body?.id || ''), req.body?.note);
      return res.status(200).json({ ok: true, row });
    }

    if (action === 'milestone-delete') {
      await deleteMilestone(String(req.body?.id || ''));
      return res.status(200).json({ ok: true });
    }

    if (action === 'milestone-complete') {
      const row = await completeMilestone(String(req.body?.id || ''));
      return res.status(200).json({ ok: true, row });
    }

    if (action === 'milestone-uncomplete') {
      await uncompleteMilestone(String(req.body?.id || ''));
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ ok: false, error: 'INVALID CORE DATA ACTION' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || 'FAILED TO UPDATE CORE DATA' });
  }
}
