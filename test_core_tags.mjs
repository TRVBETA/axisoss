// AXIS // v64 task-group tests: tag allowlist, createTodo tag flow with
// fallback when the column is missing, fetchCoreData tag-select fallback.
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://mock.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

const calls = [];
let failNextCoreTodosInsert = false;   // simulate "tag column missing"
let failTagSelect = false;             // simulate fetch with tag column failing

global.fetch = async (url, options = {}) => {
  const u = String(url);
  const method = String(options.method || 'GET').toUpperCase();
  calls.push({ url: u, method, options });
  const isTodoInsert = method === 'POST' && /core_todos(\?|$)/.test(u);
  if (isTodoInsert && failNextCoreTodosInsert) {
    failNextCoreTodosInsert = false;
    return { ok: false, status: 400, json: async () => ({ code: '42703' }), text: async () => 'column "tag" does not exist', headers: { get: () => null } };
  }
  if (method === 'GET' && /core_todos\?/.test(u)) {
    if (failTagSelect && /[?&]select=[^&]*tag/.test(u)) {
      return { ok: false, status: 400, json: async () => ({ code: '42703' }), text: async () => 'column "tag" does not exist', headers: { get: () => null } };
    }
    let rows = [
      { id: 't1', title: 'Algebra notes', is_done: false, impact: 2, resistance: 3, depth: 0, tag: 'college', created_at: '2026-10-09T10:00:00Z' },
      { id: 't2', title: 'Push day', is_done: true, impact: 1, resistance: 2, depth: 0, tag: 'body', completed_day_key: '2026-10-09', created_at: '2026-10-08T10:00:00Z' }
    ];
    if (!/[?&]select=[^&]*tag/.test(u)) rows = rows.map(({ tag, ...rest }) => rest); // real PG omits unselected columns
    return { ok: true, status: 200, json: async () => rows, text: async () => JSON.stringify(rows), headers: { get: () => null } };
  }
  if (isTodoInsert) {
    const posted = JSON.parse(options.body);
    const body = [{ id: 'new-1', ...posted }];
    return { ok: true, status: 201, json: async () => body, text: async () => JSON.stringify(body), headers: { get: () => null } };
  }
  // balance row, task events, everything else
  return { ok: true, status: 200, json: async () => [{ id: 'bal-1' }], text: async () => '[{"id":"bal-1"}]', headers: { get: () => null } };
};

const { normalizeTaskTag, normalizeTodoForV4, TASK_TAGS } = await import('./lib/axisScoreV4.js');
const { createTodo, fetchCoreData } = await import('./lib/coreDataServer.js');

// 1) allowlist
assert.deepEqual(TASK_TAGS, ['college', 'body', 'mind', 'music', 'design']);
assert.equal(normalizeTaskTag('COLLEGE'), 'college');
assert.equal(normalizeTaskTag(' music '), 'music');
assert.equal(normalizeTaskTag('gym'), null);
assert.equal(normalizeTaskTag(''), null);
assert.equal(normalizeTaskTag(null), null);

// 2) passthrough in normalizeTodoForV4
assert.equal(normalizeTodoForV4({ title: 'x', tag: 'BODY', impact: 2, resistance: 2 }).tag, 'body');
assert.equal(normalizeTodoForV4({ title: 'x', tag: 'nope' }).tag, null);

// 3) createTodo writes the tag
calls.length = 0;
const created = await createTodo({ title: 'Study calc', impact: 2, resistance: 2, tag: 'COLLEGE' });
const insert = calls.find(c => c.method === 'POST' && /core_todos(\?|$)/.test(c.url));
assert.ok(insert, 'no core_todos insert happened');
assert.equal(JSON.parse(insert.options.body).tag, 'college');
assert.equal(created.tag, 'college');

// 4) no tag → key absent from payload (nulls not written)
calls.length = 0;
await createTodo({ title: 'Plain task', impact: 1, resistance: 1 });
assert.equal('tag' in JSON.parse(calls.find(c => c.method === 'POST' && /core_todos(\?|$)/.test(c.url)).options.body), false);

// 5) tag column missing on the server → retry without tag, tag kept client-side
failNextCoreTodosInsert = true;
calls.length = 0;
const retryRow = await createTodo({ title: 'Fallback task', impact: 3, resistance: 3, tag: 'design' });
const inserts = calls.filter(c => c.method === 'POST' && /core_todos(\?|$)/.test(c.url));
assert.equal(inserts.length, 2, `expected insert + retry, got ${inserts.length}`);
assert.equal('tag' in JSON.parse(inserts[1].options.body), false, 'retry must drop the tag key');
assert.equal(retryRow.tag, 'design', 'row still reports the tag client-side');
assert.equal(retryRow.impact, 3, 'retry must NOT degrade to the legacy bare insert (impact survives)');

// 6) fetchCoreData: tag in select; when the column is missing it refetches without it
failTagSelect = false;
calls.length = 0;
let core = await fetchCoreData();
assert.ok(calls.some(c => c.method === 'GET' && /core_todos\?/.test(c.url) && /[?&]select=[^&]*tag/.test(c.url)), 'tag must be in the primary select');
assert.equal(core.todos.find(t => t.id === 't1').tag, 'college');
assert.equal(core.todos.find(t => t.id === 't2').tag, 'body');

failTagSelect = true;
calls.length = 0;
core = await fetchCoreData();
const todoGets = calls.filter(c => c.method === 'GET' && /core_todos\?/.test(c.url));
assert.ok(todoGets.length >= 2, 'expected a refetch without tag');
assert.ok(todoGets.slice(1).every(c => !/[?&]select=[^&]*tag/.test(c.url)), 'refetch must omit tag');
assert.equal(core.todos[0].tag, null, 'rows degrade to tag=null when column is missing');

console.log('core-tags-tests-ok');
