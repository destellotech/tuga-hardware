// The /admin page is one served string (src/admin-page.js) whose inline
// script never passes through a bundler, so a syntax slip would only show
// in the browser. Parse it here instead.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_PAGE } from '../src/admin-page.js';

test('the admin page inline script parses', () => {
  const js = ADMIN_PAGE.slice(ADMIN_PAGE.indexOf('<script>') + 8, ADMIN_PAGE.lastIndexOf('</script>'));
  assert.ok(js.length > 1000);
  assert.doesNotThrow(() => new Function(js));
});
