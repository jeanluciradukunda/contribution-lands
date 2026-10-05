#!/usr/bin/env node
/**
 * Writes docs/data/library.js and docs/assets/library/*.webp: every NYC sprite the extension can draw,
 * with its role and metadata, for docs/library.html. Needs `cwebp` on PATH (brew install webp).
 * Usage: node tools/site/build-library.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const THEME_DIR = join(ROOT, 'themes/city-nyc');
const OUT_IMG = join(ROOT, 'docs/assets/library');
const OUT_DATA = join(ROOT, 'docs/data/library.js');

const theme = JSON.parse(readFileSync(join(THEME_DIR, 'theme.json'), 'utf8'));
const contentTs = readFileSync(join(ROOT, 'extension/src/content/content.ts'), 'utf8');
const bandsMatch = contentTs.match(/ABSOLUTE_BANDS\s*=\s*\[([\d,\s]+)\]/);
if (!bandsMatch) throw new Error('ABSOLUTE_BANDS not found in extension/src/content/content.ts');
const BANDS = bandsMatch[1].split(',').map(Number);

const levelBand = (level) => {
  if (level === 0) return { min: 0, max: 0, label: '0 a day' };
  const min = BANDS[level - 1];
  const max = level < BANDS.length ? BANDS[level] - 1 : null;
  return { min, max, label: max == null ? `${min}+ a day` : `${min}-${max} a day` };
};

const STAGES = ['nothing yet', 'groundwork', 'frame', 'cladding', 'topping out'];
const ROLES = { 1: 'Brownstone or shop', 2: 'Walk-up', 3: 'Tower', 4: 'Skyscraper' };

function pngSize(file) {
  const b = readFileSync(file);
  if (b.readUInt32BE(12) !== 0x49484452) throw new Error(`${file} is not a PNG`);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

const landmarks = new Map((theme.landmarks ?? []).map((l, i) => [l.sprite, { name: l.name, order: i + 1 }]));
const parks = new Set(theme.park_sprites ?? []);
const today = theme.today_sprites ?? [];

rmSync(OUT_IMG, { recursive: true, force: true });
mkdirSync(OUT_IMG, { recursive: true });

const sprites = [];
for (const file of readdirSync(join(THEME_DIR, 'sprites')).sort()) {
  const lv = file.match(/^level-(\d)-([a-z]+)\.png$/);
  const stage = today.indexOf(file);
  if (!lv && stage < 0) continue;
  const src = join(THEME_DIR, 'sprites', file);
  const { w, h } = pngSize(src);
  const id = file.replace(/\.png$/, '');
  let entry;
  if (lv) {
    const level = Number(lv[1]);
    const letter = lv[2];
    const lm = landmarks.get(file);
    const group = lm ? 'landmark' : level === 0 ? (parks.has(file) ? 'park' : 'lot') : `l${level}`;
    const role = lm ? 'Landmark' : level === 0 ? (parks.has(file) ? 'Weekend park' : 'Empty lot') : ROLES[level];
    entry = { id, level, letter, group, role, name: lm ? lm.name : `${role} ${letter}`, ...(lm && { order: lm.order }) };
  } else {
    entry = { id, level: stage, group: 'today', role: `Construction stage ${stage}`, stage, name: `Stage ${stage}, ${STAGES[stage]}` };
  }
  const webp = `${id}.webp`;
  execFileSync('cwebp', ['-quiet', '-q', '80', '-alpha_q', '90', '-m', '6', src, '-o', join(OUT_IMG, webp)]);
  sprites.push({ ...entry, src: `assets/library/${webp}`, w, h, ratio: Math.round((h / w) * 10) / 10, bytes: statSync(join(OUT_IMG, webp)).size });
}

const order = { lot: 0, park: 1, l1: 2, l2: 3, l3: 4, l4: 5, landmark: 6, today: 7 };
sprites.sort((a, b) => order[a.group] - order[b.group] || (a.order ?? 0) - (b.order ?? 0) || a.level - b.level || a.id.localeCompare(b.id, 'en', { numeric: true }));

const levels = [0, 1, 2, 3, 4].map((level) => ({ level, ...levelBand(level) }));
const data = { theme: theme.name, bands: BANDS, levels, stages: STAGES, sprites };
writeFileSync(OUT_DATA, `window.CL_LIBRARY = ${JSON.stringify(data)};\n`);

const total = sprites.reduce((s, x) => s + x.bytes, 0);
console.log(`Wrote ${sprites.length} sprites, ${(total / 1024).toFixed(0)} KB of WebP`);
