const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers');

function setup({ inactive = false, invalidToken = false, missingRole = false, missingStatus = false, gates = {} } = {}) {
  const calls = [];
  const profile = { id: 7, auth_user_id: 'user-seven', nombre: 'Usuario', apellido: 'Prueba', correo: 'test@example.test', id_rol: 1, id_estado: inactive ? 2 : 1 };
  const rows = { usuario: profile, rol: missingRole ? null : { id: 1, nombre: 'Cliente' }, estado_usuario: missingStatus ? null : { id: profile.id_estado, nombre: inactive ? 'Inactivo' : 'Activo' } };
  const db = { from(table) {
    return { select() { return this; }, eq(column, value) { calls.push({ table, column, value }); return this; }, async single() { if (gates[table]) await gates[table]; return { data: rows[table], error: null }; } };
  } };
  const middleware = load('middlewares/auth.middleware.js', {
    '../config/supabase': { auth: { getUser: async token => { assert.equal(token, 'valid-token'); return invalidToken ? { data: {}, error: new Error('invalid') } : { data: { user: { id: 'user-seven' } }, error: null }; } } },
    '../config/authenticated-supabase': token => { assert.equal(token, 'valid-token'); return db; },
  });
  const req = { headers: { authorization: 'Bearer valid-token' } };
  const res = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
  return { middleware, req, res, calls, db };
}

test('authentication loads role and status concurrently while retaining the user-scoped client', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const { middleware, req, res, calls, db } = setup({ gates: { rol: gate, estado_usuario: gate } });
  let continued = false;
  const pending = middleware(req, res, () => { continued = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls.map(call => call.table), ['usuario', 'rol', 'estado_usuario']);
  assert.equal(continued, false, 'must wait for both checks');
  release(); await pending;
  assert.equal(continued, true);
  assert.equal(req.supabase, db);
  assert.equal(req.user.id, 7);
  assert.equal(req.user.role, 'Cliente');
  assert.equal(req.user.status, 'Activo');
});

test('parallel authentication still rejects inactive users, missing catalogs, and invalid tokens', async () => {
  for (const [options, code, status] of [
    [{ inactive: true }, 'USER_INACTIVE', 403],
    [{ missingRole: true }, 'USER_ROLE_NOT_FOUND', 403],
    [{ missingStatus: true }, 'USER_STATUS_NOT_FOUND', 403],
    [{ invalidToken: true }, 'INVALID_OR_EXPIRED_TOKEN', 401],
  ]) {
    const { middleware, req, res } = setup(options);
    let continued = false;
    await middleware(req, res, () => { continued = true; });
    assert.equal(continued, false);
    assert.equal(res.statusCode, status);
    assert.equal(res.body.code, code);
  }
});
