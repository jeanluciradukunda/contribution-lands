#!/usr/bin/env node
/**
 * Renders a profile's contribution land as a PNG for a README.
 *
 *   node render.mjs --user octocat --theme city-nyc --out land.webp [--scheme dark]
 *
 * Serves the built card page (extension/card-dist) and the repo's themes, then
 * drives a local Chrome to it. Requests the content script makes to github.com
 * are answered from here, since the page itself cannot read GitHub cross-origin.
 */
import { createServer } from 'node:http';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import puppeteer from 'puppeteer-core';

const ROOT = resolve(import.meta.dirname, '../..');
const CARD = join(ROOT, 'extension/card-dist');
const THEMES = join(ROOT, 'themes');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const CHROME_PATHS = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

const { values: args } = parseArgs({
  options: {
    user: { type: 'string' },
    theme: { type: 'string', default: 'city-nyc' },
    out: { type: 'string', default: 'contribution-land.webp' },
    scheme: { type: 'string', default: 'light' },
  },
});
if (!args.user) throw new Error('--user is required');
if (!existsSync(join(CARD, 'index.html'))) throw new Error(`Card page not built: run "pnpm build:card" in extension/ (looked in ${CARD})`);
if (!existsSync(join(THEMES, args.theme, 'theme.json'))) throw new Error(`Unknown theme "${args.theme}"`);

async function github(path) {
  const res = await fetch(`https://github.com${path}`, { headers: { 'user-agent': 'contribution-lands-card' } });
  if (!res.ok) throw new Error(`GitHub ${path}: ${res.status}`);
  return res.text();
}

const calendar = await github(`/users/${encodeURIComponent(args.user)}/contributions`);

function serveFile(res, file) {
  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
}

function spriteManifest(theme) {
  const dir = join(THEMES, theme, 'sprites');
  const grouped = {};
  for (const file of readdirSyncSafe(dir)) {
    const level = file.match(/^level-(\d)-/)?.[1];
    if (level) (grouped[level] ??= []).push(file);
  }
  for (const list of Object.values(grouped)) list.sort();
  return JSON.stringify(grouped);
}

function readdirSyncSafe(dir) {
  try {
    return readdirSync(dir).filter((f) => f.endsWith('.png'));
  } catch {
    return [];
  }
}


const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://card');
  if (url.pathname === '/__calendar') {
    res.writeHead(200, { 'content-type': 'text/html' }).end(calendar);
    return;
  }
  const manifest = url.pathname.match(/^\/themes\/([^/]+)\/sprites\/manifest\.json$/);
  if (manifest) {
    res.writeHead(200, { 'content-type': 'application/json' }).end(spriteManifest(manifest[1]));
    return;
  }
  if (url.pathname.startsWith('/themes/')) {
    serveFile(res, join(THEMES, normalize(url.pathname.slice('/themes/'.length)).replace(/^(\.\.[/\\])+/, '')));
    return;
  }
  const asset = join(CARD, normalize(url.pathname).replace(/^(\.\.[/\\])+/, ''));
  serveFile(res, existsSync(asset) && statSync(asset).isFile() ? asset : join(CARD, 'index.html'));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const executablePath = CHROME_PATHS.find((p) => existsSync(p));
if (!executablePath) throw new Error('No Chrome found; set CHROME_PATH');
const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 940, height: 900, deviceScaleFactor: 2 });
  await page.setRequestInterception(true);
  page.on('request', async (request) => {
    const url = new URL(request.url());
    if (url.hostname !== 'github.com') return request.continue();
    try {
      const body = await github(url.pathname + url.search);
      await request.respond({ status: 200, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body });
    } catch {
      await request.respond({ status: 502, headers: { 'access-control-allow-origin': '*' }, body: '' });
    }
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(`http://127.0.0.1:${port}/${encodeURIComponent(args.user)}?theme=${args.theme}&scheme=${args.scheme}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#contribution-lands-canvas', { timeout: 30000 });
  await page.waitForFunction(() => !document.body.textContent.includes('Checking earlier years'), { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1000));
  if (errors.length) throw new Error(`Card page errors: ${errors.join('; ')}`);

  const card = await page.$('.card');
  const type = args.out.endsWith('.png') ? 'png' : 'webp';
  await card.screenshot({ path: args.out, type, omitBackground: true, ...(type === 'webp' ? { quality: 88 } : {}) });
  console.log(`Wrote ${args.out}`);
} finally {
  await browser.close();
  server.close();
}
