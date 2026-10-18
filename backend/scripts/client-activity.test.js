const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup(options, { status = 200, failAudit = false } = {}) {
  const logs = [], sent = [];
  const sandbox = { module: { exports: {} }, console: { error() {} }, require() { return { recordLog: async log => { if (failAudit) throw new Error('Audit unavailable'); logs.push(log); } }; } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/middlewares/client-activity.middleware.js'), 'utf8'), sandbox);
  const req = { user: { id: 12 }, params: { id: '7' }, body: { userId: 99 }, ip: '127.0.0.1' };
  const res = { statusCode: status, json(body) { sent.push(body); return body; }, redirect(...args) { sent.push(args); } };
  let next = false;
  sandbox.module.exports(options)(req, res, () => { next = true; });
  assert.equal(next, true);
  return { req, res, logs, sent };
}
for (const [action, entity] of [
  ['SUBIR_ARCHIVO', 'archivo'], ['DESCARGAR_ARCHIVO', 'archivo'],
  ['ELIMINAR_ARCHIVO', 'archivo'], ['COMPARTIR_ARCHIVO', 'archivo'],
  ['COMPARTIR_CARPETA', 'carpeta'], ['ELIMINAR_CARPETA', 'carpeta'],
]) {
  test(`${action} records successful operation with authenticated actor`, async () => {
    const ctx = setup({ action, entity, description: 'Operación completada' });
    await ctx.res.json({ success: true, data: { id: 100, id_archivo: entity === 'archivo' ? 7 : null, id_carpeta: entity === 'carpeta' ? 7 : null, nombre: 'Documento', id_usuario_receptor: 20 } });
    assert.equal(ctx.logs.length, 1);
    assert.equal(ctx.logs[0].id_usuario, 12);
    assert.equal(ctx.logs[0].id_entidad_afectada, 7);
    assert.equal(ctx.logs[0].accion, action);
    assert.equal(ctx.logs[0].detalles.resourceName, 'Documento');
    assert.equal(ctx.logs[0].detalles.receiverUserId, 20);
  });
}
test('validation errors and denied operations produce no success activity', async () => {
  for (const status of [400, 403, 404, 409, 500, 503]) {
    const ctx = setup({ action: 'SUBIR_ARCHIVO', entity: 'archivo' }, { status });
    await ctx.res.json({ success: false, message: 'No permitido' });
    assert.equal(ctx.logs.length, 0); assert.equal(ctx.sent.length, 1);
  }
});
test('successful download redirect records exactly one event', async () => {
  const ctx = setup({ action: 'DESCARGAR_ARCHIVO', entity: 'archivo' });
  await ctx.res.redirect('https://storage.example/signed');
  assert.equal(ctx.logs.length, 1); assert.equal(ctx.logs[0].id_entidad_afectada, 7);
  assert.equal(JSON.stringify(ctx.logs).includes('storage.example'), false);
});
test('audit failure does not fail or duplicate an already completed operation', async () => {
  const ctx = setup({ action: 'ELIMINAR_ARCHIVO', entity: 'archivo' }, { failAudit: true });
  const response = await ctx.res.json({ success: true });
  assert.equal(response.success, true); assert.equal(ctx.sent.length, 1);
});
