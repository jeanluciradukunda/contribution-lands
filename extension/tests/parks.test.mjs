import test from 'node:test';
import assert from 'node:assert/strict';
import { findPark, nearRegion, parkLayout } from '../.test-build/parks.js';

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

const sizes = [[9, 7.5], [14, 7.5], [24.5, 7.5], [52, 7.5]];

test('layout is deterministic and keeps trees inside the park', () => {
  for (const [w, h] of sizes) {
    const layout = parkLayout(w, h);
    assert.deepEqual(layout, parkLayout(w, h));
    assert.ok(layout.trees.length > 0);
    for (const t of layout.trees) assert.ok(t.x > 0 && t.x < w && t.y > 0 && t.y < h);
    assert.ok(layout.trees.length <= 2400);
  }
});

test('no tree stands on water, the reservoir, a path or a landmark', () => {
  for (const [w, h] of sizes) {
    const layout = parkLayout(w, h);
    const wet = layout.regions.filter((r) => r.kind !== 'lawn');
    for (const t of layout.trees) {
      assert.ok(!wet.some((r) => nearRegion(t, r, 0)), 'tree in water');
      for (const l of layout.landmarks) assert.ok(Math.hypot(t.x - l.x, t.y - l.y) >= 0.55);
      for (const path of layout.paths) for (const p of path) assert.ok(Math.hypot(t.x - p.x, t.y - p.y) >= 0.2);
    }
  }
});

test('the Reservoir is large, the Lake south of it, the Great Lawn between them, Harlem Meer at the north end', () => {
  const layout = parkLayout(24.5, 7.5);
  const area = (poly) => Math.abs(poly.reduce((sum, p, i) => sum + (p.x * poly[(i + 1) % poly.length].y - poly[(i + 1) % poly.length].x * p.y), 0) / 2);
  const centre = (region) => {
    const pts = region.polys.flat();
    return { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
  };
  const reservoir = layout.regions.find((r) => r.kind === 'reservoir');
  const water = layout.regions.filter((r) => r.kind === 'water');
  const lawns = layout.regions.filter((r) => r.kind === 'lawn');
  const share = area(reservoir.polys[0]) / (24.5 * 7.5);
  assert.ok(share > 0.1 && share < 0.25, `reservoir share ${share}`);
  const [lake, meer] = water.sort((a, b) => centre(a).x - centre(b).x);
  assert.ok(centre(lake).x < centre(reservoir).x - 3);
  assert.ok(centre(meer).x > 0.9 * 24.5);
  const between = lawns.filter((l) => centre(l).x > centre(lake).x && centre(l).x < centre(reservoir).x);
  assert.equal(between.length, 1, 'one lawn between the lake and the reservoir');
});

test('landmarks sit on their shores, not in the water', () => {
  const layout = parkLayout(24.5, 7.5);
  const lake = layout.regions.find((r) => r.kind === 'water');
  const reservoir = layout.regions.find((r) => r.kind === 'reservoir');
  const bethesda = layout.landmarks.find((l) => l.role === 'bethesda');
  const belvedere = layout.landmarks.find((l) => l.role === 'belvedere');
  assert.ok(!nearRegion(bethesda, lake, 0) && nearRegion(bethesda, lake, 1.2));
  assert.ok(!nearRegion(belvedere, reservoir, 0) && nearRegion(belvedere, reservoir, 1.2));
  assert.ok(nearRegion({ x: layout.bridge.x0, y: (layout.bridge.y0 + layout.bridge.y1) / 2 }, lake, 0), 'bow bridge spans the lake');
});

test('canopy is about 70% of the park, with only the Lake and Harlem Meer as water', () => {
  const area = (poly) => Math.abs(poly.reduce((sum, p, i) => sum + (p.x * poly[(i + 1) % poly.length].y - poly[(i + 1) % poly.length].x * p.y), 0) / 2);
  for (const [w, h] of sizes) {
    const layout = parkLayout(w, h);
    const open = layout.regions.reduce((s, r) => s + r.polys.reduce((a, p) => a + area(p), 0), 0) / (w * h);
    assert.ok(open > 0.22 && open < 0.38, `open share ${open} at ${w}`);
    const water = layout.regions.filter((r) => r.kind === 'water').length;
    assert.equal(water, w >= 12 ? 2 : 1);
    assert.ok(layout.regions.filter((r) => r.kind === 'lawn').length <= 5);
  }
});
