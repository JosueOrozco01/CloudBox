'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validate } = require('../src/services/subscription-checkout.service');

test('checkout acepta payload pagado valido', () => {
  assert.deepEqual(validate({ planId: 1, paymentMethodId: 1, referenceCode: 'TEST-SUB-00001' }), {
    planId: 1, paymentMethodId: 1, referenceCode: 'TEST-SUB-00001', simulateFailure: false
  });
});
test('checkout no acepta IDs invalidos', () => {
  assert.throws(() => validate({ planId: 0, paymentMethodId: 1, referenceCode: 'TEST-SUB-00002' }), { status: 400 });
});
test('checkout no acepta referencia incorrecta', () => {
  assert.throws(() => validate({ planId: 2, paymentMethodId: 1, referenceCode: 'x' }), { status: 400 });
});
test('simulateFailure debe ser boolean', () => {
  assert.throws(() => validate({ planId: 2, paymentMethodId: 1, referenceCode: 'TEST-SUB-00003', simulateFailure: 'false' }), { status: 400 });
});
