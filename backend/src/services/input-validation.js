const policy = require('../../../shared/password-policy.json');
const pattern = new RegExp(policy.pattern);
const invalid = message => Object.assign(new Error(message), { status: 400, code: 'INVALID_INPUT' });
function email(value) {
  if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) throw invalid('Ingresa un correo electrónico válido.');
  return value.trim().toLowerCase();
}
function password(value) { if (typeof value !== 'string' || !pattern.test(value)) throw invalid(policy.message); return value; }
function text(value, label, max = 100) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw invalid(label + ' debe contener entre 1 y ' + max + ' caracteres.');
  return value.trim();
}
module.exports = { email, password, text, invalid, passwordMessage: policy.message };
