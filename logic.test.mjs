import assert from 'node:assert/strict';
import { suggest, historyFor, weeklyAverage, toCSV, validateData, templateForWeekday, prescription, roundToStep } from './logic.js';

const e = (weight, reps) => ({ ex: 'bench', weight, reps });

assert.equal(suggest('bench', []), null);
assert.deepEqual(suggest('bench', [e(40, [8, 8, 8])]), { weight: 42.5, reason: 'up' });
assert.deepEqual(suggest('bench', [e(40, [8, 8, 7])]), { weight: 40, reason: 'same' });
assert.deepEqual(suggest('bench', [e(40, [4, 4, 3]), e(40, [5, 4, 4])]), { weight: 35, reason: 'reset' });
// reset only triggers on two misses at the SAME weight
assert.deepEqual(suggest('bench', [e(42.5, [4, 4, 3]), e(40, [4, 4, 4])]), { weight: 42.5, reason: 'same' });
// one miss is not a reset
assert.deepEqual(suggest('bench', [e(40, [4, 4, 3]), e(40, [6, 6, 6])]), { weight: 40, reason: 'same' });
// incomplete session never counts as top
assert.deepEqual(suggest('bench', [e(40, [8, 8])]), { weight: 40, reason: 'same' });
// dumbbell step of 2, reset rounds to step
assert.deepEqual(suggest('dbpress', [{ ex: 'dbpress', weight: 14, reps: [12, 12, 12] }]), { weight: 16, reason: 'up' });
assert.equal(roundToStep(36.9, 2.5), 37.5);
assert.equal(roundToStep(12.6, 2), 12);
// plank: step 0, "up" keeps weight 0
assert.deepEqual(suggest('plank', [{ ex: 'plank', weight: 0, reps: [60, 60, 60] }]), { weight: 0, reason: 'up' });

const sessions = [
  { id: 'a', date: '2026-09-01', template: 'UA', entries: [e(40, [5, 5, 5]), { ex: 'row', weight: 40, reps: [6, 6, 6] }] },
  { id: 'b', date: '2026-09-04', template: 'UA', entries: [e(40, [6, 6, 5])] },
];
const h = historyFor(sessions, 'bench');
assert.equal(h.length, 2);
assert.equal(h[0].date, '2026-09-04');
assert.equal(historyFor(sessions, 'squat').length, 0);

const body = [
  { date: '2026-09-01', bw: 78.0 },
  { date: '2026-09-03', bw: 78.4 },
  { date: '2026-09-07', bw: 78.2 },
  { date: '2026-08-20', bw: 80.0 },
];
assert.equal(weeklyAverage(body, '2026-09-07').toFixed(2), '78.20');
assert.equal(weeklyAverage(body, '2026-08-01'), null);

const csv = toCSV({ sessions, body: [{ date: '2026-09-01', bw: 78, waist: 92 }] });
assert.match(csv, /^type,date,template/);
assert.match(csv, /set,2026-09-01,UA,bench,40,5,5,5,,\n/);
assert.match(csv, /body,2026-09-01,,,,,,,78,92\n/);

assert.equal(templateForWeekday(1), 'UA');
assert.equal(templateForWeekday(3), null);
assert.equal(templateForWeekday(6), null);
assert.equal(prescription('bench'), '3 × 5–8');
assert.equal(prescription('deadlift'), '3 × 5');
assert.equal(prescription('plank'), '3 × 30–60 s');

assert.throws(() => validateData({}), /version/);
assert.throws(() => validateData({ version: 1, sessions: [{ date: 'x', template: 'ZZ', entries: [] }], body: [] }), /Unknown template/);
assert.throws(() => validateData({ version: 1, sessions: [{ date: 'x', template: 'UA', entries: [{ ex: 'nope', weight: 1, reps: [] }] }], body: [] }), /Unknown exercise/);
validateData({ version: 1, sessions, body });

console.log('all logic tests passed');

// --- assisted pull-up: progress runs downward (less machine assistance is harder)
const pu = (weight, reps) => ({ ex: 'pullup', weight, reps });
assert.deepEqual(suggest('pullup', [pu(40, [10, 10, 10])]), { weight: 35, reason: 'up' });
assert.deepEqual(suggest('pullup', [pu(40, [8, 7, 6])]), { weight: 40, reason: 'same' });
// two misses at the same assistance -> MORE assistance, not less
assert.deepEqual(suggest('pullup', [pu(40, [3, 3, 2]), pu(40, [4, 3, 3])]), { weight: 45, reason: 'reset' });
// 20 * 1.1 = 22, which rounds back to 20 on a 5 kg stack; the reset must still move
assert.deepEqual(suggest('pullup', [pu(20, [3, 3, 2]), pu(20, [4, 3, 3])]), { weight: 25, reason: 'reset' });
// assistance never goes negative: at 5 kg a good session lands on 0, not -5
assert.deepEqual(suggest('pullup', [pu(5, [10, 10, 10])]), { weight: 0, reason: 'up' });
assert.deepEqual(suggest('pullup', [pu(0, [10, 10, 10])]), { weight: 0, reason: 'up' });
// a normal lift is unaffected, and its reset still moves down
assert.deepEqual(suggest('bench', [e(40, [8, 8, 8])]), { weight: 42.5, reason: 'up' });
assert.deepEqual(suggest('bench', [e(40, [4, 4, 3]), e(40, [5, 4, 4])]), { weight: 35, reason: 'reset' });
// a normal lift whose 10% drop rounds back to itself must still move down one step
assert.deepEqual(suggest('lunge', [{ ex: 'lunge', weight: 10, reps: [4, 4] }, { ex: 'lunge', weight: 10, reps: [5, 4] }]), { weight: 8, reason: 'reset' });

console.log('assist tests passed');
