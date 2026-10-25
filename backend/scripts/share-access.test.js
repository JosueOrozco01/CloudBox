const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function load(responses) {
  const calls = [];
  let signed = 0;
  const client = { from(table) {
    const call = { table, filters: [] }; calls.push(call);
    const result = responses.shift();
    assert.ok(result, `Unexpected query: ${table}`);
    const query = {};
    for (const method of ['select', 'eq', 'not', 'or', 'order', 'in', 'insert', 'update', 'is', 'limit', 'neq', 'ilike']) {
      query[method] = (...args) => { call.filters.push([method, ...args]); return query; };
    }
    query.single = query.maybeSingle = async () => result;
    query.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
    return query;
  } };
  const sandbox = { module: { exports: {} }, process: { env: {} }, require(name) {
    if (name === '@supabase/supabase-js') return { createClient: () => client };
    if (name === './storage.service') return { createSignedUrl: async () => { signed++; return 'https://storage.example/signed'; } };
    throw new Error(`Unexpected module ${name}`);
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/services/share.service.js'), 'utf8'), sandbox);
  return { service: sandbox.module.exports, calls, signed: () => signed };
}
const ok = data => ({ data, error: null });

test('unauthorized recipient never receives a signed download URL', async () => {
  const ctx = load([ok({ id: 10, id_usuario: 1, id_carpeta: null, id_estado: 1 }), ok(null)]);
  await assert.rejects(ctx.service.getSharedDownload({ userId: 2, fileId: 10 }), { status: 403 });
  assert.equal(ctx.signed(), 0);
  assert.ok(ctx.calls[1].filters.some(([method, value]) => method === 'or' && value.includes('fecha_expiracion.gt.')));
  assert.ok(ctx.calls[1].filters.some(([method, key, value]) => method === 'eq' && key === 'id_estado' && value === 1));
});
test('active direct viewer share allows download', async () => {
  const ctx = load([ok({ id: 10, id_usuario: 1, id_carpeta: null, id_estado: 1 }), ok([{ id: 5, id_permiso: 2 }]), ok({ nombre: 'test.pdf', ruta_storage: 'private/test.pdf' })]);
  const result = await ctx.service.getSharedDownload({ userId: 2, fileId: 10 });
  assert.equal(result.expiresIn, 60); assert.equal(ctx.signed(), 1);
});
test('viewer cannot satisfy editor permission', async () => {
  const ctx = load([ok({ id: 10, id_usuario: 1, id_carpeta: null, id_estado: 1 }), ok([{ id: 5, id_permiso: 2 }])]);
  const access = await ctx.service.validateFileAccess({ userId: 2, fileId: 10, requiredPermission: 1 });
  assert.equal(access.hasAccess, false);
});
test('folder content is denied when access was revoked or expired', async () => {
  const ctx = load([ok({ id: 3, id_usuario: 1, id_padre: null, id_estado: 1 }), ok(null)]);
  await assert.rejects(ctx.service.getSharedFolderContent({ userId: 2, folderId: 3 }), { status: 403 });
  assert.equal(ctx.calls.length, 2);
});
test('recipient cannot revoke an outgoing share owned by another user', async () => {
  const ctx = load([ok({ id: 5, id_usuario_emisor: 1, id_estado: 1 })]);
  await assert.rejects(ctx.service.revokeShare({ shareId: 5, actorUserId: 2 }), { status: 403 });
  assert.equal(ctx.calls.length, 1);
});
test('folder sharing validates owner and creates a folder share', async () => {
  const ctx = load([ok({ id: 1, id_estado: 1 }), ok({ id: 2, id_estado: 1 }), ok({ id: 3, id_usuario: 1, id_estado: 1 }), ok([]), ok({ id: 9 })]);
  await ctx.service.shareFolder({ senderUserId: 1, receiverUserId: 2, folderId: 3, permissionId: 2 });
  const insert = ctx.calls.at(-1).filters.find(([method]) => method === 'insert')[1];
  assert.equal(insert.id_carpeta, 3); assert.equal(insert.id_archivo, null); assert.equal(insert.id_usuario_emisor, 1);
});

test('subfolder content can be read through an active inherited folder share', async () => {
  const ctx = load([
    ok({ id: 4, id_usuario: 1, id_padre: 3, id_estado: 1 }), ok(null),
    ok({ id: 3, id_usuario: 1, id_padre: null, id_estado: 1 }), ok([{ id: 8, id_permiso: 2 }]),
    ok([{ id: 5, nombre: 'Hija' }]), ok([{ id: 10, nombre: 'Documento.pdf' }])
  ]);
  const result = await ctx.service.getSharedFolderContent({ userId: 2, folderId: 4 });
  assert.equal(result.access.hasAccess, true); assert.equal(result.access.permissionId, 2);
  assert.equal(result.files[0].id, 10);
});

test('recipient search filters active users, excludes sender and limits exposed data', async () => {
  const ctx = load([ok([{ nombre: 'Ana', apellido: 'Prueba', correo: 'ana@example.com' }])]);
  const users = await ctx.service.searchRecipients({ userId: 12, query: '  Ana  ' });
  assert.equal(users.length, 1);
  const filters = ctx.calls[0].filters;
  assert.ok(filters.some(([m, key, value]) => m === 'eq' && key === 'id_estado' && value === 1));
  assert.ok(filters.some(([m, key, value]) => m === 'neq' && key === 'id' && value === 12));
  assert.ok(filters.some(([m, key, value]) => m === 'ilike' && key === 'correo' && value === 'ana%'));
  assert.ok(filters.some(([m, count]) => m === 'limit' && count === 8));
  assert.equal(filters.find(([m]) => m === 'select')[1], 'nombre, apellido, correo');
});
test('recipient search does not query directory for empty, short or wildcard terms', async () => {
  const ctx = load([]);
  for (const query of ['', 'a', '%', 'an*', 'an,correo', 'x'.repeat(255), undefined]) {
    assert.equal((await ctx.service.searchRecipients({ userId: 12, query })).length, 0);
  }
  assert.equal(ctx.calls.length, 0);
});
test('recipient search escapes literal underscore in email prefixes', async () => {
  const ctx = load([ok([])]);
  await ctx.service.searchRecipients({ userId: 12, query: 'ana_' });
  const filter = ctx.calls[0].filters.find(([m]) => m === 'ilike');
  assert.equal(filter[2], 'ana' + String.fromCharCode(92) + '_%');
});
