#!/usr/bin/env node
/**
 * Writes docs/data/year.js: every day of one profile's public contribution calendar
 * (about 53 weeks), for the site's hero. Usage: node tools/site/snapshot-year.mjs <username>
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const user = process.argv[2] ?? 'jeanluciradukunda';
const MIN_DAYS = 52 * 7;
const res = await fetch(`https://github.com/users/${encodeURIComponent(user)}/contributions`, {
  headers: { 'user-agent': 'contribution-lands-site' },
});
if (!res.ok) throw new Error(`GitHub ${res.status}`);
const html = await res.text();

const counts = new Map();
for (const [, target, text] of html.matchAll(/<tool-tip[^>]*\bfor="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
  const m = text.match(/(\d[\d,]*|No) contributions? on/);
  if (m) counts.set(target, m[1] === 'No' ? 0 : Number(m[1].replace(/,/g, '')));
}
const days = [];
for (const [cell] of html.matchAll(/<td[^>]*ContributionCalendar-day[^>]*>/g)) {
  const date = cell.match(/data-date="([\d-]+)"/)?.[1];
  const id = cell.match(/\bid="([^"]+)"/)?.[1];
  const level = Number(cell.match(/data-level="(\d)"/)?.[1] ?? 0);
  if (date) days.push({ date, count: counts.get(id) ?? 0, level });
}
days.sort((a, b) => a.date.localeCompare(b.date));
if (days.length < MIN_DAYS) throw new Error(`only ${days.length} days parsed`);
const year = days.map((d) => [d.date, d.count, d.level]);

const body = `window.CL_YEAR = ${JSON.stringify({ user, taken: new Date().toISOString().slice(0, 10), days: year })};\n`;
writeFileSync(resolve(import.meta.dirname, '../../docs/data/year.js'), body);
console.log(`Wrote ${year.length} days for ${user}, ${year[0][0]} to ${year.at(-1)[0]}`);
