// The worker's canonical URL rules (src/worker.js): every folder that the
// build writes an index.html into must keep its trailing slash, or the
// worker and the asset layer bounce the visitor between /x/ and /x.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, existsSync } from 'node:fs';
import { canonicalPath } from '../src/worker.js';

test('every built folder index is a known directory index', () => {
  const folders = readdirSync(new URL('..', import.meta.url), { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && existsSync(new URL(`../${d.name}/index.html`, import.meta.url)))
    .map((d) => `/${d.name}/`);
  assert.ok(folders.includes('/for/'), 'the trades hub is built');
  for (const f of folders) {
    assert.equal(canonicalPath(f), f, `${f} must keep its trailing slash`);
    assert.equal(canonicalPath(f.slice(0, -1)), f, `${f.slice(0, -1)} must redirect to ${f}`);
    assert.equal(canonicalPath(`${f}index.html`), f);
  }
});

test('ordinary pages lose extensions and trailing slashes', () => {
  assert.equal(canonicalPath('/about.html'), '/about');
  assert.equal(canonicalPath('/for/electricians/'), '/for/electricians');
  assert.equal(canonicalPath('/products/tuga-h6'), '/products/tuga-a6');
  assert.equal(canonicalPath('/'), '/');
});
