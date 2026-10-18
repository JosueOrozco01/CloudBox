const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function setup(validPassword = true) {
  const updates = [], signouts = [];
  const admin = { updateUserById: async (...args) => { updates.push(args); return { error: null }; }, signOut: async (...args) => { signouts.push(args); return { error: null }; } };
  const sandbox = { module: { exports: {} }, process: { env: {} }, require(name) {
    if (name === '@supabase/supabase-js') return { createClient: () => ({ auth: { admin } }) };
    if (name === '../services/session-history.service') return { recordCloseOthers: async () => {} };
    if (name === '../services/user.service') return { verifyCurrentPassword: async () => validPassword };
    throw new Error(name);
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/controllers/settings.controller.js'), 'utf8'), sandbox);
  const req = { authUser: { id: 'session-user', user_metadata: { existing: 'preserved' } }, headers: { authorization: 'Bearer verified-token' }, body: {} };
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  const next = error => { throw error; };
  return { controller: sandbox.module.exports, updates, signouts, req, res, next };
}
test('preferences save in existing auth metadata for session identity only', async () => {
  const ctx = setup();
  ctx.req.body = { theme: 'oscuro', language: 'Español (América Latina)', showKB: false, authUserId: 'someone-else', role: 'Administrador' };
  await ctx.controller.savePreferences(ctx.req, ctx.res, ctx.next);
  assert.equal(ctx.updates[0][0], 'session-user');
  const metadata = ctx.updates[0][1].user_metadata;
  assert.equal(metadata.existing, 'preserved');
  assert.equal(metadata.cloudbox_preferences.theme, 'oscuro');
  assert.equal(metadata.cloudbox_preferences.role, undefined);
});
test('invalid preference payload does not update account', async () => {
  const ctx = setup(); ctx.req.body = { theme: 'unknown', showKB: 'yes' };
  await ctx.controller.savePreferences(ctx.req, ctx.res, ctx.next);
  assert.equal(ctx.res.statusCode, 400); assert.equal(ctx.updates.length, 0);
});
test('default preferences do not require any database table', async () => {
  const ctx = setup(); await ctx.controller.getPreferences(ctx.req, ctx.res);
  assert.equal(ctx.res.body.data.theme, 'claro'); assert.equal(ctx.res.body.data.showKB, true);
});
test('incorrect current password never updates credentials', async () => {
  const ctx = setup(false); ctx.req.body = { currentPassword: 'Wrong123!', newPassword: 'NewPassword123!' };
  await ctx.controller.changePassword(ctx.req, ctx.res, ctx.next);
  assert.equal(ctx.res.statusCode, 400); assert.equal(ctx.updates.length, 0);
});
test('weak or unchanged password is rejected', async () => {
  for (const password of ['short', 'password123', 'OldPassword123!']) {
    const ctx = setup(); ctx.req.body = { currentPassword: 'OldPassword123!', newPassword: password };
    await ctx.controller.changePassword(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 400); assert.equal(ctx.updates.length, 0);
  }
});
test('password change uses session user and no recovery workflow', async () => {
  const ctx = setup(); ctx.req.body = { currentPassword: 'OldPassword123!', newPassword: 'NewPassword123!', id: 'someone-else' };
  await ctx.controller.changePassword(ctx.req, ctx.res, ctx.next);
  assert.equal(ctx.res.statusCode, 200); assert.equal(ctx.updates[0][0], 'session-user');
  assert.equal(ctx.updates[0][1].password, 'NewPassword123!');
});
test('closing other sessions passes the current JWT and preserves its session scope', async () => {
  const ctx = setup(); await ctx.controller.logoutOthers(ctx.req, ctx.res, ctx.next);
  assert.equal(ctx.signouts[0][0], 'verified-token'); assert.equal(ctx.signouts[0][1], 'others');
});

test('current password verification closes only its temporary sign-in session', async () => {
  const scopes = [];
  const client = { auth: {
    signInWithPassword: async () => ({ data: { user: { id: 'session-user' } }, error: null }),
    signOut: async options => { scopes.push(options.scope); return { error: null }; }
  } };
  const sandbox = { module: { exports: {} }, process: { env: {} }, require: () => ({ createClient: () => client }) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/services/user.service.js'), 'utf8'), sandbox);
  const valid = await sandbox.module.exports.verifyCurrentPassword({ id: 'session-user', email: 'test@example.com' }, 'TestPassword1!');
  assert.equal(valid, true); assert.equal(scopes.length, 1); assert.equal(scopes[0], 'local');
});

test('email notification choices are persisted as booleans and read back', async () => {
  const ctx = setup();
  ctx.req.body = { theme: 'claro', language: 'Español (América Latina)', showKB: true, notifications: [{ id: 'storage', enabled: true }, { id: 'shared', enabled: false }] };
  await ctx.controller.savePreferences(ctx.req, ctx.res, ctx.next);
  const prefs = ctx.updates[0][1].user_metadata.cloudbox_preferences;
  assert.equal(prefs.notifications.find(item => item.id === 'storage').enabled, true);
  ctx.req.authUser.user_metadata.cloudbox_preferences = prefs;
  await ctx.controller.getPreferences(ctx.req, ctx.res);
  assert.equal(ctx.res.body.data.notifications.find(item => item.id === 'storage').enabled, true);
});
