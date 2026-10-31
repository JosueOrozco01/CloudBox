import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { applyPreferences, beginAccountAppearance, previewAccountTheme, resetAppearance, restoreAccountAppearance, restoreCachedPreferences } from '../src/utils/preferences.js';
import { clearSession, logout, persistSession } from '../src/services/authService.js';

const originalFetch = globalThis.fetch;
let systemDark = false;
const accountA = { token: 'test-token-a', refreshToken: 'test-refresh-a', user: { id: 1 } };
const accountB = { token: 'test-token-b', refreshToken: 'test-refresh-b', user: { id: 2 } };
const dark = { theme: 'oscuro', showKB: false };
const light = { theme: 'claro', showKB: true };
const theme = () => document.documentElement.dataset.theme;

beforeEach(() => {
  const values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key), clear: () => values.clear() };
  globalThis.document = { documentElement: { dataset: {}, lang: 'es' } };
  globalThis.window = Object.assign(new EventTarget(), { matchMedia: () => ({ matches: systemDark }) });
  systemDark = false;
  resetAppearance();
});
afterEach(() => { globalThis.fetch = originalFetch; });

test('a dark account cannot color a new account without saved preferences', () => {
  persistSession(accountA);
  assert.equal(applyPreferences(1, dark, accountA.token), true);
  assert.equal(theme(), 'dark');
  persistSession(accountB);
  assert.equal(theme(), 'light');
  assert.equal(document.documentElement.dataset.sizeUnit, 'KB');
  assert.equal(localStorage.getItem('cloudbox:preferences:2'), null);
  assert.equal(JSON.parse(localStorage.getItem('cloudbox:preferences:1')).theme, 'oscuro');
});

test('returning to each account restores its own saved theme and file units', () => {
  persistSession(accountA); applyPreferences(1, dark);
  persistSession(accountB); applyPreferences(2, light);
  persistSession(accountA);
  assert.equal(theme(), 'dark');
  assert.equal(document.documentElement.dataset.sizeUnit, 'MB');
  persistSession(accountB);
  assert.equal(theme(), 'light');
  assert.equal(document.documentElement.dataset.sizeUnit, 'KB');
});

test('preview cleanup after logout cannot restore the previous dark theme', () => {
  persistSession(accountA); applyPreferences(1, dark);
  clearSession(accountA.token);
  assert.equal(restoreAccountAppearance(1, accountA.token), false);
  assert.equal(previewAccountTheme(1, 'oscuro', accountA.token), false);
  assert.equal(theme(), 'light');
  assert.equal(document.documentElement.dataset.themeMode, 'claro');
});

test('late requests and old previews cannot modify another account or its cache', () => {
  persistSession(accountA); applyPreferences(1, dark);
  persistSession(accountB); applyPreferences(2, light);
  assert.equal(applyPreferences(1, dark, accountA.token), false);
  assert.equal(applyPreferences(1, dark), false);
  assert.equal(restoreAccountAppearance(1, accountA.token), false);
  assert.equal(previewAccountTheme(1, 'oscuro', accountA.token), false);
  assert.equal(clearSession(accountA.token), false);
  assert.equal(theme(), 'light');
  assert.equal(localStorage.getItem('token'), accountB.token);
  assert.equal(JSON.parse(localStorage.getItem('cloudbox:preferences:2')).theme, 'claro');
});

test('leaving a preview restores saved preferences; cleanup after saving uses the latest value', () => {
  persistSession(accountA); applyPreferences(1, light);
  assert.equal(previewAccountTheme(1, 'oscuro', accountA.token), true);
  assert.equal(theme(), 'dark');
  restoreAccountAppearance(1, accountA.token);
  assert.equal(theme(), 'light');
  previewAccountTheme(1, 'oscuro', accountA.token);
  applyPreferences(1, dark, accountA.token);
  restoreAccountAppearance(1, accountA.token);
  assert.equal(theme(), 'dark');
});

test('system mode is explicit to its owner; unknown and malformed caches fall back to light', () => {
  systemDark = true;
  persistSession(accountA); applyPreferences(1, { ...light, theme: 'sistema' });
  assert.equal(theme(), 'dark');
  persistSession(accountB);
  assert.equal(theme(), 'light');
  localStorage.setItem('cloudbox:preferences:2', '{invalid');
  restoreCachedPreferences();
  assert.equal(theme(), 'light');
  localStorage.setItem('cloudbox:preferences:2', JSON.stringify({ theme: 'unexpected' }));
  beginAccountAppearance(2);
  assert.equal(theme(), 'light');
});

test('a pending logout cannot clear the account that signed in afterwards', async () => {
  let finish;
  globalThis.fetch = () => new Promise(resolve => { finish = resolve; });
  persistSession(accountA); applyPreferences(1, dark);
  const pendingLogout = logout();
  persistSession(accountB); applyPreferences(2, light);
  finish({ ok: true, json: async () => ({ success: true }) });
  assert.equal((await pendingLogout).sessionChanged, true);
  assert.equal(localStorage.getItem('token'), accountB.token);
  assert.equal(theme(), 'light');
});
