const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const jwt = sessionId => `header.${Buffer.from(JSON.stringify({ session_id: sessionId, sub: 'auth-user', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`;
function setup(rows = [], lookup = async () => ({ ok: true, json: async () => ({ success: true, city: 'Guatemala', country: 'Guatemala' }) })) {
  const logs = [], filters = [];
  let lookups = 0;
  const db = { from(table) {
    filters.push(['from', table]); const query = {};
    for (const method of ['select', 'eq', 'in', 'order', 'limit']) query[method] = (...args) => { filters.push([method, ...args]); return query; };
    query.then = resolve => Promise.resolve({ data: rows, error: null }).then(resolve);
    return query;
  } };
  const sandbox = { Buffer, Date, AbortSignal, console, process: { env: {} }, module: { exports: {} }, fetch: async (...args) => { lookups++; return lookup(...args); }, require(name) {
    if (name === 'node:net') return require(name);
    if (name === '@supabase/supabase-js') return { createClient: () => db };
    if (name === './audit.service') return { recordLog: async record => { logs.push(record); } };
    throw new Error(name);
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/services/session-history.service.js'), 'utf8'), sandbox);
  return { service: sandbox.module.exports, logs, filters, lookups: () => lookups };
}
const request = { ip: '127.0.0.1', headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/123.0' }, user: { id: 12 }, authUser: { last_sign_in_at: '2026-10-18T00:00:00Z' } };
test('local IP never triggers geolocation or invents a city', async () => {
  const ctx = setup(); const sessions = await ctx.service.list(request, jwt('current'));
  assert.equal(sessions[0].device, 'Chrome en Windows');
  assert.equal(sessions[0].city, null); assert.equal(sessions[0].location, 'Red local o privada');
  assert.equal(ctx.lookups(), 0);
  assert.ok(ctx.filters.some(([m, key, value]) => m === 'eq' && key === 'id_usuario' && value === 12));
});
test('public IP geolocation is cached and login logs do not contain tokens', async () => {
  const ctx = setup(); const req = { ...request, ip: '8.8.8.8' };
  const token = jwt('current');
  await ctx.service.recordLogin(req, 12, token); await ctx.service.recordLogin(req, 12, token);
  assert.equal(ctx.lookups(), 1); assert.equal(ctx.logs[0].detalles.city, 'Guatemala');
  assert.equal(JSON.stringify(ctx.logs).includes(token), false);
});
test('geolocation failure does not prevent login activity recording', async () => {
  const ctx = setup([], async () => { throw new Error('Network unavailable'); });
  await ctx.service.recordLogin({ ...request, ip: '8.8.8.8' }, 12, jwt('current'));
  assert.equal(ctx.logs.length, 1); assert.equal(ctx.logs[0].detalles.location, 'Ubicación no disponible');
});
test('history hides expired and closed sessions and keeps current session', async () => {
  const row = (id, expiresAt) => ({ accion: 'SESION_INICIADA', fecha: '2026-01-01T00:00:00Z', detalle: JSON.stringify({ id, device: 'Firefox', expiresAt }) });
  const ctx = setup([
    { accion: 'SESION_CERRADA', fecha: '2026-02-01T00:00:00Z', detalle: JSON.stringify({ sessionId: 'closed' }) },
    row('closed', Date.now() + 60000), row('expired', 1), row('valid', Date.now() + 60000)
  ]);
  const sessions = await ctx.service.list(request, jwt('current'));
  assert.equal(sessions.length, 2); assert.equal(sessions[0].isCurrent, true); assert.equal(sessions[1].id, 'valid');
});
test('closing other sessions hides earlier accesses without hiding the retained session', async () => {
  const ctx = setup([
    { accion: 'OTRAS_SESIONES_CERRADAS', fecha: '2026-02-01T00:00:00Z', detalle: JSON.stringify({ sessionId: 'current' }) },
    { accion: 'SESION_INICIADA', fecha: '2026-01-01T00:00:00Z', detalle: JSON.stringify({ id: 'old', expiresAt: Date.now() + 60000 }) }
  ]);
  const sessions = await ctx.service.list(request, jwt('current'));
  assert.equal(sessions.length, 1); assert.equal(sessions[0].id, 'current');
});
