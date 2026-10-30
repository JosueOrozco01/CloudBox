const test = require('node:test');
const assert = require('node:assert/strict');
const { reference, parseId, amountToCents, transactionId } = require('../src/services/payment-rules');
test('reference validates strict format', () => {
  assert.equal(reference('REF-20261024-001'), 'REF-20261024-001');
  assert.throws(() => reference('x'), { code: 'INVALID_PAYMENT_REFERENCE' });
  assert.throws(() => reference('not safe!*'), { code: 'INVALID_PAYMENT_REFERENCE' });
});
test('IDs must be positive safe integers', () => {
  assert.equal(parseId('72', 'userId'), 72);
  assert.throws(() => parseId('1.2', 'userId'));
  assert.throws(() => parseId(-1, 'userId'));
});
test('price is converted without floating-point rounding', () => {
  assert.equal(amountToCents('9.99'), 999);
  assert.equal(amountToCents('0.30'), 30);
  assert.throws(() => amountToCents('1.999'));
});
test('transaction IDs differ', () => assert.notEqual(transactionId(), transactionId()));
