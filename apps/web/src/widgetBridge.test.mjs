/** Minimal smoke checks for widget deep links & snapshot shape helpers. */
import { handleDeepLink } from './widgetBridge.js';
import assert from 'node:assert/strict';

assert.deepEqual(handleDeepLink('luckytodo://home?tab=today'), {
  path: 'home',
  tab: 'today',
  type: null,
  id: null,
  day: null,
});

assert.equal(handleDeepLink('https://example.com'), null);
assert.equal(handleDeepLink('luckytodo://item?type=todo&id=abc').id, 'abc');
assert.equal(handleDeepLink('luckytodo://create?type=event&day=2026-09-29').day, '2026-09-29');

console.log('widgetBridge.test.mjs ok');
