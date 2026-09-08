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

export default async function handler(req, res) {
  if (!isAuthenticatedRequest(req)) {
    return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
  }

  if (req.method === 'GET') {
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
