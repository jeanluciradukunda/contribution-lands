import test from 'node:test';
import assert from 'node:assert/strict';
import { findPark, parkLandmarkCount, placeLandmarks, PARK_LANDMARKS } from '../.test-build/parks.js';

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

test('landmark count scales with the district', () => {
  assert.deepEqual([8, 9, 10, 12, 13, 16, 17, 30].map(parkLandmarkCount), [3, 3, 5, 5, 6, 6, 8, 8]);
  assert.equal(parkLandmarkCount(30), PARK_LANDMARKS.length);
});

test('landmarks are interior, deterministic, never touching, iconic first near the middle', () => {
  const span = { firstWeek: 20, lastWeek: 31 };
  const slots = placeLandmarks(span, 5, () => true);
  assert.deepEqual(slots, placeLandmarks(span, 5, () => true));
  assert.equal(slots.length, 5);
  for (const s of slots) {
    assert.ok(s.week > span.firstWeek && s.week < span.lastWeek, 'last week is the wall');
    assert.ok(s.day >= 1 && s.day <= 4, 'day 6 is the wall');
  }
  for (const a of slots) for (const b of slots) if (a !== b) assert.ok(Math.max(Math.abs(a.week - b.week), Math.abs(a.day - b.day)) >= 2);
  const distance = (s) => Math.abs(s.week - 25.5);
  assert.ok(distance(slots[0]) <= distance(slots[4]));
  assert.deepEqual(slots.map((s) => s.index), [0, 1, 2, 3, 4]);
});

test('landmarks avoid blocked cells and skip when the park is too small', () => {
  const span = { firstWeek: 0, lastWeek: 8 };
  const slots = placeLandmarks(span, 3, (week) => week !== 4);
  assert.equal(slots.length, 3);
  assert.ok(slots.every((s) => s.week !== 4));
  assert.deepEqual(placeLandmarks({ firstWeek: 0, lastWeek: 1 }, 3, () => true), []);
});
