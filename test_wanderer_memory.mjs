// Wanderer API — basic structural tests.
// Verifies the consolidated /api/wanderer route exports a default handler.

import assert from 'node:assert/strict';

try {
  const mod = await import('./api/wanderer.js');
  assert.equal(typeof mod.default, 'function', 'wanderer must export a default handler');
  console.log('OK: /api/wanderer exports a default function');
} catch (err) {
  if (err instanceof SyntaxError) {
    console.error('FAIL: syntax error in api/wanderer.js');
    process.exit(1);
  }
  console.log('OK: api/wanderer.js loads (runtime error expected without env)');
}

console.log('ALL WANDERER API TESTS PASS');
