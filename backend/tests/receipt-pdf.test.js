'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { generatePdfBuffer } = require('../src/services/receipt-pdf');
test('genera un PDF válido sin credenciales externas', async () => {
  const buffer = await generatePdfBuffer({ number: 100001, date: '2026-10-24', amount: 29,
    userName: 'Usuario Prueba', email: 'prueba@example.com', reference: 'REF-TEST', transaction: 'TRX-TEST', methodName: 'Tarjeta', planName: 'Básico' });
  assert.ok(Buffer.isBuffer(buffer));
  assert.equal(buffer.subarray(0, 5).toString(), '%PDF-');
  assert.ok(buffer.length > 800);
});
