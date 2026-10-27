'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalize } = require('../src/services/subscription.service');
const date = new Date('2026-10-25T00:00:00Z');
const row = { id: 15, id_plan: 1, fecha_inicio: '2026-10-25', fecha_fin: '2026-12-24' };
const paid = { nombre: 'Básico', precio: 29, espacio_maximo_gb: 5 };
test('Cancelada y Renovada conservan fechas pero no días disponibles', () => {
  for (const status of ['Cancelada','Renovada','Vencida','Pendiente']) {
    const out = normalize(row, paid, status, date);
    assert.equal(out.daysRemaining, 0);
    assert.equal(out.endDate, '2026-12-24');
  }
});
test('Free activo no expone vencimiento artificial', () => {
  const out = normalize({...row, id_plan: 8, fecha_fin: '2126-10-01'}, { nombre:'Free',precio:0,espacio_maximo_gb:1 }, 'Activa', date);
  assert.equal(out.daysRemaining, null);
});
test('PorVencer conserva días reales', () => {
  const out = normalize(row, paid, 'PorVencer', date);
  assert.ok(out.daysRemaining > 0);
});
