const crypto = require('node:crypto');

function fail(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function parseId(value, field) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw fail(400, 'INVALID_IDENTIFIER', `${field} debe ser un entero positivo`);
  return id;
}

function reference(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{7,99}$/.test(value)) {
    throw fail(400, 'INVALID_PAYMENT_REFERENCE', 'referenceCode debe contener de 8 a 100 caracteres alfanuméricos, _ o -');
  }
  return value;
}

function amountToCents(value) {
  if (!/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(String(value))) {
    throw fail(500, 'INVALID_PLAN_PRICE', 'El precio del plan no es válido');
  }
  const [whole, fraction = ''] = String(value).split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

function transactionId() { return `TRX-SIM-${crypto.randomUUID()}`; }

module.exports = { fail, parseId, reference, amountToCents, transactionId };
