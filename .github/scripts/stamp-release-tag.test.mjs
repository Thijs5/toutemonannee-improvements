import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const script = fileURLToPath(new URL('./stamp-release-tag.sh', import.meta.url));

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'tma-tag-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const repo = join(root, 'repo');
  const origin = join(root, 'origin.git');
  mkdirSync(repo);
  function git(...args) {
    const result = spawnSync('git', ['-c', 'commit.gpgsign=false', '-c', 'tag.gpgSign=false', ...args], { cwd: repo, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  }
  git('init', '--bare', origin);
  git('init', '-b', 'main');
  git('config', 'user.name', 'Release test');
  git('config', 'user.email', 'release-test@example.com');
  writeFileSync(join(repo, 'tma-downloader.user.js'), '// @version 0.0.0\n');
  git('add', '.');
  git('commit', '-m', 'Development source');
  const main = git('rev-parse', 'HEAD');
  git('tag', '-a', 'v1.4.0', '-m', 'Release v1.4.0');
  git('remote', 'add', 'origin', origin);
  git('push', 'origin', 'main', 'v1.4.0');
  git('checkout', '--detach', 'v1.4.0');
  writeFileSync(join(root, 'asset.user.js'), '// @version 1.4.0\n');
  const stamp = () => spawnSync('bash', [script, 'v1.4.0', join(root, 'asset.user.js')], { cwd: repo, encoding: 'utf8' });
  const remoteTag = () => git('ls-remote', 'origin', 'refs/tags/v1.4.0').split(/\s/)[0];
  return { git, main, stamp, remoteTag };
}

test('publishes a stamped tag without changing main, and can be retried', t => {
  const { git, main, stamp, remoteTag } = fixture(t);
  const result = stamp();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(git('rev-parse', 'main'), main);
  assert.equal(git('show', 'main:tma-downloader.user.js'), '// @version 0.0.0');
  assert.equal(git('show', 'v1.4.0:tma-downloader.user.js'), '// @version 1.4.0');
  assert.equal(remoteTag(), git('rev-parse', 'refs/tags/v1.4.0'));
  const stampedTag = remoteTag();
  assert.equal(stamp().status, 0);
  assert.equal(remoteTag(), stampedTag);
});

test('rejects publishing over a concurrently changed remote tag', t => {
  const { git, main, stamp, remoteTag } = fixture(t);
  git('push', '--force', 'origin', `${main}:refs/tags/v1.4.0`);
  const concurrentTag = remoteTag();
  const result = stamp();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /stale info/);
  assert.equal(remoteTag(), concurrentTag);
});
