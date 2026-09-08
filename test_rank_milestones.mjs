import assert from 'node:assert/strict';
import { deriveRankFromCount } from './lib/coreDataServer.js';

// Default ladder thresholds (milestones): 0 / 3 / 6 / 10 / 15 / 20 / 26 / 33 / 40 / ???
const ranks = [
  { level: 1, name: 'RANK I', shortLabel: 'RANK I', minCount: 0, color: '#8c8a84' },
  { level: 2, name: 'RANK II', shortLabel: 'RANK II', minCount: 3, color: '#b7bec8' },
  { level: 3, name: 'RANK III', shortLabel: 'RANK III', minCount: 6, color: '#c89c64' },
  { level: 4, name: 'RANK IV', shortLabel: 'RANK IV', minCount: 10, color: '#a2b896' },
  { level: 5, name: 'RANK V', shortLabel: 'RANK V', minCount: 15, color: '#d1b07b' },
  { level: 6, name: 'RANK VI', shortLabel: 'RANK VI', minCount: 20, color: '#f43f5e' },
  { level: 7, name: 'RANK VII', shortLabel: 'RANK VII', minCount: 26, color: '#b7bec8' },
  { level: 8, name: 'RANK VIII', shortLabel: 'RANK VIII', minCount: 33, color: '#a2b896' },
  { level: 9, name: 'THE REVOLUTION', shortLabel: 'REVOLUTION', minCount: 40, color: '#ffffff' },
  { level: 10, name: '???', shortLabel: '???', minCount: null, color: '#8c8a84' },
];

// Zero / clamp
assert.equal(deriveRankFromCount(0, ranks).level, 1);
assert.equal(deriveRankFromCount(-5, ranks).count, 0);
assert.equal(deriveRankFromCount(undefined, ranks).level, 1);

// Boundaries
assert.equal(deriveRankFromCount(2, ranks).level, 1);
assert.equal(deriveRankFromCount(3, ranks).level, 2);
assert.equal(deriveRankFromCount(5, ranks).level, 2);
assert.equal(deriveRankFromCount(6, ranks).level, 3);
assert.equal(deriveRankFromCount(39, ranks).level, 8);
assert.equal(deriveRankFromCount(40, ranks).level, 9);
assert.equal(deriveRankFromCount(40, ranks).shortLabel, 'REVOLUTION');
assert.equal(deriveRankFromCount(40, ranks).name, 'THE REVOLUTION');

// Rank 9 (REVOLUTION) is the cap — never auto-reveals ???
const cap = deriveRankFromCount(999, ranks);
assert.equal(cap.level, 9);
assert.equal(cap.isMax, true);
assert.equal(cap.progressPct, 100);

// Progress math (level 1 -> 2: 0..3 milestones)
const mid = deriveRankFromCount(1, ranks);
assert.equal(mid.level, 1);
assert.equal(mid.progressPct, 33);
assert.equal(mid.milestonesToNext, 2);

console.log('rank-milestones-tests-ok');
