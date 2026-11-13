const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { load, database } = require('./helpers');
const authorizeRole = require('../src/middlewares/role.middleware');

test('administrative catalog includes inactive plans and normalizes commercial numbers', async () => {
  const db = database({ plan: [
    { id: 1, nombre: 'Free', precio: '0', espacio_maximo_gb: '1', id_estado: 1 },
    { id: 2, nombre: 'Anterior', precio: '9.00', espacio_maximo_gb: '5', id_estado: 2 },
  ] });
  const service = load('services/plan.service.js', { '@supabase/supabase-js': { createClient: () => db } });
  const rows = await service.getAllPlans();
  assert.equal(rows.length, 2);
  const inactive = rows.find(row => row.id === 2);
  assert.equal(inactive.estado, 'Inactivo');
  assert.equal(inactive.precio, 9);
  assert.equal(inactive.espacio_maximo_gb, 5);
  db.fail({ message: 'private database detail' });
  await assert.rejects(service.getAllPlans(), error => error.code === 'DATABASE_ERROR' && !error.message.includes('private'));
});

test('HTTP admin catalog requires authentication and administrator role; public catalog stays separate', async () => {
  const service = {
    getAllPlans: async () => [{ id: 2, estado: 'Inactivo' }],
    getActivePlans: async () => [{ id: 1, estado: 'Activo' }],
  };
  const controller = load('controllers/plan.controller.js', {
    '../services/plan.service': service,
    '../services/audit.service': { recordLog: async () => {} },
  });
  const auth = (req, res, next) => {
    if (!req.headers.authorization) return res.status(401).json({ success: false });
    req.user = { role: req.headers.authorization === 'Bearer admin' ? 'Administrador' : 'Cliente' };
    next();
  };
  const routes = load('routes/plan.routes.js', {
    express,
    '../controllers/plan.controller': controller,
    '../middlewares/auth.middleware': auth,
    '../middlewares/role.middleware': authorizeRole,
  });
  const app = express();
  app.use('/api/plans', routes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/plans`;
  try {
    assert.equal((await fetch(`${url}/admin/all`)).status, 401);
    assert.equal((await fetch(`${url}/admin/all`, { headers: { Authorization: 'Bearer client' } })).status, 403);
    const response = await fetch(`${url}/admin/all`, { headers: { Authorization: 'Bearer admin' } });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data[0].estado, 'Inactivo');
    const publicResponse = await fetch(url);
    assert.deepEqual((await publicResponse.json()).data, [{ id: 1, estado: 'Activo' }]);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
