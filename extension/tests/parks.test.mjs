import test from 'node:test';
import assert from 'node:assert/strict';
import { findPark } from '../.test-build/parks.js';

const base = Date.UTC(2026, 0, 4);
const iso = (n) => new Date(base + n * 86400000).toISOString().slice(0, 10);

/** One year of weeks; `active` lists the week columns that hold a contribution. */
function year(weeks, active) {
  const days = [];
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) days.push({ date: iso(w * 7 + d), week: w, day: d, count: active.includes(w) ? 1 : 0 });
  }
  return days;
}
const busy = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const farFuture = '2099-01-01';

test('no qualifying gap gives no park', () => {
  assert.equal(findPark(year(52, busy(0, 51)), farFuture), null);
  assert.equal(findPark(year(52, [...busy(0, 20), ...busy(28, 51)]), farFuture), null);
});

test('seven empty weeks are too short, eight qualify', () => {
  assert.equal(findPark(year(40, [...busy(0, 9), ...busy(17, 39)]), farFuture), null);
  assert.deepEqual(findPark(year(40, [...busy(0, 9), ...busy(18, 39)]), farFuture), { firstWeek: 10, lastWeek: 17 });
});

test('two past gaps give exactly one park, the longer', () => {
  const days = year(52, [...busy(0, 5), ...busy(16, 25), ...busy(40, 51)]);
  assert.deepEqual(findPark(days, farFuture), { firstWeek: 26, lastWeek: 39 });
});

test('a gap reaching the future beats a longer past gap', () => {
  const days = year(52, [...busy(0, 3), ...busy(20, 41)]);
  const today = iso(42 * 7 + 2);
  assert.deepEqual(findPark(days, today), { firstWeek: 42, lastWeek: 51 });
});

test('a gap containing today counts as reaching it', () => {
  const days = year(52, [...busy(0, 3), ...busy(30, 51)]);
  assert.deepEqual(findPark(days, iso(10 * 7)), { firstWeek: 4, lastWeek: 29 });
});

test('equal past gaps: the most recent wins', () => {
  const days = year(52, [...busy(0, 2), ...busy(11, 20), ...busy(29, 51)]);
  assert.deepEqual(findPark(days, farFuture), { firstWeek: 21, lastWeek: 28 });
});

test('a partial week column is never part of a park', () => {
  const days = year(30, busy(0, 2)).filter((d) => !(d.week === 29 && d.day === 6));
  assert.deepEqual(findPark(days, farFuture), { firstWeek: 3, lastWeek: 28 });
});
