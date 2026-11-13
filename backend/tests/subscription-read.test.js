'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { daysRemaining, normalize } = require('../src/services/subscription.service');

test('vigencia expirada se limita a cero días', () => {
  assert.equal(daysRemaining('2026-01-01T00:00:00Z', new Date('2026-10-24T00:00:00Z')), 0);
});
test('vigencia parcial redondea hacia arriba', () => {
  assert.equal(daysRemaining('2026-10-25T12:00:00Z', new Date('2026-10-24T12:00:00Z')), 1);
});
test('mapea columnas reales y conserva estado PorVencer', () => {
  const out = normalize({ id: 8, id_plan: 2, id_estado: 3, fecha_inicio: '2026-10-01', fecha_fin: '2026-11-01' },
    { nombre: 'Pro', espacio_maximo_gb: 50, precio: 25 }, 'PorVencer', new Date('2026-10-24'));
  assert.equal(out.planName, 'Pro'); assert.equal(out.capacityGb, 50);
  assert.equal(out.status, 'PorVencer'); assert.equal(out.price, 25);
});
test('nulos sin suscripción no inventan fechas', () => {
  assert.equal(daysRemaining(null), null);
});
