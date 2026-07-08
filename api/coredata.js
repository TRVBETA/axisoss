import { isAuthenticatedRequest } from '../lib/axisAuth.js';
import { clearCompletedTodos, createTodo, deleteTodo, fetchCoreData, fetchTaskHistory, toggleTodo, updateBalance } from '../lib/coreDataServer.js';

export default async function handler(req, res) {
  if (!isAuthenticatedRequest(req)) {
    return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
  }

  if (req.method === 'GET') {
    try {
      const data = await fetchCoreData();
      const history = await fetchTaskHistory(120);
      return res.status(200).json({ ok: true, ...data, history });
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
        points: req.body?.points
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

    return res.status(400).json({ ok: false, error: 'INVALID CORE DATA ACTION' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || 'FAILED TO UPDATE CORE DATA' });
  }
}