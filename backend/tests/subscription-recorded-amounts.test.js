'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { getRecordedAmounts } = require('../src/services/subscription-recorded-amounts');

function database(tables) {
  return {
    from(table) {
      const filters = [];
      let maxRows = Infinity;
      const query = {
        select() { return query; },
        eq(column, value) { filters.push(row => row[column] == value); return query; },
        in(column, values) { filters.push(row => values.includes(row[column])); return query; },
        order() { return query; },
        limit(value) { maxRows = value; return query; },
        then(resolve, reject) {
          return Promise.resolve().then(() => ({
            data: (tables[table] || []).filter(row => filters.every(filter => filter(row))).slice(0, maxRows), error: null
          })).then(resolve, reject);
        }
      };
      return query;
    }
  };
}

function loadSubscriptionService(db) {
  const source = fs.readFileSync(path.join(__dirname, '../src/services/subscription.service.js'), 'utf8');
  const module = { exports: {} };
  vm.runInNewContext(source, {
    module,
    exports: module.exports,
    require: name => name === '@supabase/supabase-js'
      ? { createClient: () => db }
      : require(path.resolve(__dirname, '../src/services', name)),
    process: { env: { SUPABASE_URL: 'http://127.0.0.1:1', SUPABASE_SERVICE_ROLE_KEY: 'local-placeholder' } },
    Date, Number, Map
  });
  return module.exports;
}

test('recorded subscription amount adds approved payment and applied credit, excluding rejected payments', async () => {
  const db = database({
    pago: [
      { id_suscripcion: 10, monto: '24.00', id_estado: 1 },
      { id_suscripcion: 10, monto: '90.00', id_estado: 2 },
      { id_suscripcion: 11, monto: '25.00', id_estado: 1 }
    ],
    evento_credito_suscripcion: [
      { id_suscripcion_nueva: 10, monto_aplicado: '1.00' },
      { id_suscripcion_nueva: 11, monto_aplicado: '0.00' }
    ],
    estado_pago: [{ id: 1, nombre: 'Aprobado' }, { id: 2, nombre: 'Rechazado' }]
  });
  const totals = await getRecordedAmounts(db, [{ id: 10 }, { id: 11 }]);
  assert.deepEqual(totals.get(10), { amount: 25, hasRecord: true });
  assert.deepEqual(totals.get(11), { amount: 25, hasRecord: true });
});

test('subscription history uses stored amounts while current subscription shows the current catalog price', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const db = database({
    suscripcion: [
      { id: 10, id_usuario: 7, id_plan: 1, id_estado: 2, fecha_inicio: today, fecha_fin: today },
      { id: 11, id_usuario: 7, id_plan: 2, id_estado: 6, fecha_inicio: '2026-01-01', fecha_fin: '2026-01-30' },
      { id: 12, id_usuario: 7, id_plan: 3, id_estado: 6, fecha_inicio: '2025-12-01', fecha_fin: '2025-12-30' },
      { id: 13, id_usuario: 7, id_plan: 4, id_estado: 6, fecha_inicio: '2025-11-01', fecha_fin: '2025-11-30' }
    ],
    plan: [
      { id: 1, nombre: 'Básico', precio: '9.00', espacio_maximo_gb: '5' },
      { id: 2, nombre: 'Pro', precio: '25.00', espacio_maximo_gb: '50' },
      { id: 3, nombre: 'Premium', precio: '39.00', espacio_maximo_gb: '100' },
      { id: 4, nombre: 'Free', precio: '0.00', espacio_maximo_gb: '1' }
    ],
    estado_suscripcion: [
      { id: 2, nombre: 'Activa' }, { id: 6, nombre: 'Cancelada' }
    ],
    pago: [
      { id_suscripcion: 10, monto: '29.00', id_estado: 1 },
      { id_suscripcion: 11, monto: '24.00', id_estado: 1 }
    ],
    evento_credito_suscripcion: [{ id_suscripcion_nueva: 11, monto_aplicado: '1.00' }],
    estado_pago: [{ id: 1, nombre: 'Aprobado' }]
  });
  const service = loadSubscriptionService(db);
  const current = await service.getCurrent(7);
  assert.equal(current.price, 9);
  const history = await service.getHistory(7);
  assert.equal(history.find(row => row.id === 10).price, 29);
  assert.equal(history.find(row => row.id === 11).price, 25);
  assert.equal(history.find(row => row.id === 12).price, null);
  assert.equal(history.find(row => row.id === 13).price, 0);
});
