const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function load({ responses = [], access = { hasAccess: true } } = {}) {
  const calls = [];
  const client = { from(table) {
    const call = { table, filters: [] }; calls.push(call);
    const result = responses.shift(); assert.ok(result, `Unexpected query: ${table}`);
    const query = {};
    for (const method of ['select', 'eq', 'order', 'insert', 'delete']) query[method] = (...args) => { call.filters.push([method, ...args]); return query; };
    query.single = query.maybeSingle = async () => result;
    query.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
    return query;
  } };
  const accessCalls = [];
  const validate = async args => { accessCalls.push(args); return typeof access === 'function' ? access(args) : access; };
  const sandbox = { module: { exports: {} }, process: { env: {} }, require(name) {
    if (name === '@supabase/supabase-js') return { createClient: () => client };
    if (name === './share.service') return { validateFileAccess: validate, validateFolderAccess: validate };
    throw new Error(name);
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/services/favorite.service.js'), 'utf8'), sandbox);
  return { service: sandbox.module.exports, calls, accessCalls };
}
const ok = data => ({ data, error: null });
test('inaccessible files cannot be added to favorites', async () => {
  const ctx = load({ access: { hasAccess: false } });
  await assert.rejects(ctx.service.addFavorite(2, 10), { code: 'FILE_NOT_FOUND' });
  assert.equal(ctx.calls.length, 0);
});
test('file favorites exclude files with expired or revoked sharing access', async () => {
  const ctx = load({ responses: [ok([
    { id_archivo: 1, archivo: { id_estado: 1 } },
    { id_archivo: 2, archivo: { id_estado: 1 } }
  ])], access: args => ({ hasAccess: args.fileId === 1 }) });
  const result = await ctx.service.getFavorites(2);
  assert.equal(result.length, 1); assert.equal(result[0].id_archivo, 1);
});

test('removing a favorite deletes only the current user file association', async () => {
  const ctx = load({ responses: [ok({ id: 3 })] });
  await ctx.service.removeFavorite(2, 10);
  assert.equal(ctx.calls[0].table, 'favorito');
  assert.ok(ctx.calls[0].filters.some(([method, key, value]) => method === 'eq' && key === 'id_usuario' && value === 2));
  assert.ok(ctx.calls[0].filters.some(([method, key, value]) => method === 'eq' && key === 'id_archivo' && value === 10));
  assert.equal(ctx.calls.length, 1);
});
test('adding a file favorite handles existing database uniqueness constraint', async () => {
  const ctx = load({ responses: [ok({ id: 10, id_estado: 1 }), { data: null, error: { code: '23505' } }] });
  await assert.rejects(ctx.service.addFavorite(2, 10), { status: 409, code: 'FAVORITE_ALREADY_EXISTS' });
  const insert = ctx.calls[1].filters.find(([method]) => method === 'insert')[1];
  assert.equal(ctx.calls[1].table, 'favorito');
  assert.equal(insert.id_usuario, 2); assert.equal(insert.id_archivo, 10);
});
