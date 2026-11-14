import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../../', import.meta.url).pathname;
const files = [
  ...readdirSync(join(root, '.github/workflows')).filter((f) => /\.ya?ml$/.test(f)).map((f) => join('.github/workflows', f)),
  'action.yml',
];

// Values a caller controls must reach a script through env, never as ${{ }} inside the script text.
const CALLER_CONTROLLED = /\$\{\{\s*(inputs\.|github\.event\.|github\.head_ref)/;

function scriptLines(text) {
  const out = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)(?:- )?run:\s*(.*)$/);
    if (!m) continue;
    const indent = m[1].length;
    if (!/^[|>]/.test(m[2])) {
      out.push({ line: i + 1, text: m[2] });
      continue;
    }
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trim() && lines[j].search(/\S/) <= indent) break;
      out.push({ line: j + 1, text: lines[j] });
    }
  }
  return out;
}

for (const file of files) {
  test(`${file} keeps caller-controlled values out of run scripts`, () => {
    const offending = scriptLines(readFileSync(join(root, file), 'utf8')).filter((l) => CALLER_CONTROLLED.test(l.text));
    assert.deepEqual(offending.map((l) => `${file}:${l.line}`), []);
  });
}
