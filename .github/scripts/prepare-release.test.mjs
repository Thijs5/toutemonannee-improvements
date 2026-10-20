import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const script = fileURLToPath(new URL('./prepare-release.mjs', import.meta.url));
const original = '// ==UserScript==\n// @name Example\n// @version      1.0\n// ==/UserScript==\nconsole.log("unchanged");\n';

function prepare(t, tag, code = original) {
  const dir = mkdtempSync(join(tmpdir(), 'tma-release-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const source = join(dir, 'source.user.js');
  const output = join(dir, 'dist', 'tma-downloader.user.js');
  writeFileSync(source, code);
  const result = spawnSync(process.execPath, [script, tag, source, output], { encoding: 'utf8' });
  assert.equal(readFileSync(source, 'utf8'), code, 'source must remain unchanged');
  return { result, output };
}

for (const tag of ['v1.5.0', 'v1.5.2', 'v2.0.0']) {
  test(`stamps ${tag} into only the release metadata`, t => {
    const { result, output } = prepare(t, tag);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(output, 'utf8'), original.replace('1.0', tag.replace(/^v/, '')));
  });
}

for (const tag of ['v1', 'v1.5', '1.5.0', 'v01.5.0', 'v1.5.0-beta', 'v1.5.0\n', 'v1.5.0;echo unsafe']) {
  test(`rejects unsupported tag ${JSON.stringify(tag)} before writing an asset`, t => {
    const { result, output } = prepare(t, tag);
    assert.notEqual(result.status, 0);
    assert.equal(existsSync(output), false);
  });
}

for (const code of [original.replace('// @version      1.0\n', ''), original.replace('// @name Example', '// @version 2.0')]) {
  test('rejects missing or duplicate version metadata', t => {
    const { result, output } = prepare(t, 'v1.5.0', code);
    assert.notEqual(result.status, 0);
    assert.equal(existsSync(output), false);
  });
}
