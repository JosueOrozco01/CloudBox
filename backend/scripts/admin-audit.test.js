const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const tables = {
  LogAuditoria: [
    { id: 2, id_usuario: 1, entidad_afectada: 'usuario', id_entidad_afectada: 2, detalle: '{"newStatusId":3}' },
    { id: 1, id_usuario: 99, detalle: 'Registro antiguo sin JSON' },
    { id: 3, id_usuario: 2, entidad_afectada: 'archivo', id_entidad_afectada: 1, detalle: JSON.stringify({ resourceName: 'Informe.pdf', description: 'Archivo compartido correctamente.' }) },
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
const context = { require: name => name === '@supabase/supabase-js' ? ({createClient:()=>db}) : require(path.resolve(__dirname,'../src/services',name)), process: { env: {} }, module: { exports: {} }, Date, Number, Map };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/services/admin.service.js'), 'utf8'), context);
(async () => {
  const result = await context.module.exports.getAuditLogs(2, 0);
  assert.equal(result.total, 3);
  assert.equal(result.logs[0].actorName, 'Admin Uno');
  assert.equal(result.logs[0].targetName, 'Cliente Dos');
  assert.equal(result.logs[0].resultDescription, 'Estado asignado: Suspendido');
  assert.equal(result.logs[1].actorName, 'Usuario no disponible');
  assert.equal(result.logs[1].resultDescription, null);
  assert.equal((await context.module.exports.getAuditLogs(1, 1)).logs[0].id, 1);
  const resourceLog = (await context.module.exports.getAuditLogs(1, 2)).logs[0];
  assert.equal(resourceLog.actorName, 'Cliente Dos');
  assert.equal(resourceLog.targetName, 'Informe.pdf');
  assert.equal(resourceLog.resultDescription, 'Archivo compartido correctamente.');
  console.log('OK: detalle de auditoría, usuarios ausentes, registros antiguos y paginación.');
})().catch(error => { console.error(error); process.exitCode = 1; });
