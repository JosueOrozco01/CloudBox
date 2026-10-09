const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const tables = {
  LogAuditoria: [
    { id: 2, id_usuario: 1, entidad_afectada: 'usuario', id_entidad_afectada: 2, detalle: '{"newStatusId":3}' },
    { id: 1, id_usuario: 99, detalle: 'Registro antiguo sin JSON' },
  ],
  usuario: [{ id: 1, nombre: 'Admin', apellido: 'Uno' }, { id: 2, nombre: 'Cliente', apellido: 'Dos' }],
  estado_usuario: [{ id: 3, nombre: 'Suspendido' }],
  rol: [{ id: 1, nombre: 'Cliente' }],
};
const db = { from(table) {
  return {
    select() { return this; }, order() { return this; },
    async range(start, end) { return { data: tables[table].slice(start, end + 1), count: tables[table].length, error: null }; },
    async in(column, ids) { return { data: tables[table].filter(row => ids.includes(row[column])), error: null }; },
  };
} };
const context = { require: () => ({ createClient: () => db }), process: { env: {} }, module: { exports: {} }, Date, Number, Map };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/services/admin.service.js'), 'utf8'), context);
(async () => {
  const result = await context.module.exports.getAuditLogs(2, 0);
  assert.equal(result.total, 2);
  assert.equal(result.logs[0].actorName, 'Admin Uno');
  assert.equal(result.logs[0].targetName, 'Cliente Dos');
  assert.equal(result.logs[0].resultDescription, 'Estado asignado: Suspendido');
  assert.equal(result.logs[1].actorName, 'Usuario no disponible');
  assert.equal(result.logs[1].resultDescription, null);
  assert.equal((await context.module.exports.getAuditLogs(1, 1)).logs[0].id, 1);
  console.log('OK: detalle de auditoría, usuarios ausentes, registros antiguos y paginación.');
})().catch(error => { console.error(error); process.exitCode = 1; });
