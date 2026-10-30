const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { load, database } = require('./helpers');
const errorHandler = require('../src/middlewares/error-handler.middleware');

test('security HTTP: real middleware, controllers and services retain privileged flows and own-profile boundaries', async () => {
  const tables = {
    usuario: [
      { id:1, auth_user_id:'user', nombre:'Uno', apellido:'Apellido', id_rol:1, id_estado:1 },
      { id:2, auth_user_id:'other', nombre:'Dos', apellido:'Apellido', id_rol:1, id_estado:1 },
      { id:3, auth_user_id:'admin', nombre:'Admin', apellido:'Apellido', id_rol:2, id_estado:1 },
      { id:4, auth_user_id:'inactive', nombre:'Inactivo', id_rol:1, id_estado:2 }
    ],
    rol:[{id:1,nombre:'Cliente'},{id:2,nombre:'Administrador'}],
    estado_usuario:[{id:1,nombre:'Activo'},{id:2,nombre:'Inactivo'}],
    LogAuditoria:[]
  };
  const sessionDb = database(tables);
  const privilegedDb = database(tables);
  privilegedDb.auth = {admin:{listUsers:async () => ({data:{users:[]},error:null})}};
  const sdk = { createClient:() => privilegedDb };
  const auth = load('middlewares/auth.middleware.js', {
    '../config/supabase':{auth:{getUser:async token => token==='invalid'
      ? {data:{},error:{message:'invalid'}} : {data:{user:{id:token}},error:null}}},
    '../config/authenticated-supabase':() => sessionDb
  });
  const admin = load('services/admin.service.js', {'@supabase/supabase-js':sdk});
  const audit = load('services/audit.service.js', {'@supabase/supabase-js':sdk});
  const users = load('services/user.service.js', {'@supabase/supabase-js':sdk});
  const revocations = [];
  users.verifyCurrentPassword = async (_,password) => password === 'valid';
  users.revokeUserSessions = async token => revocations.push(token);
  const adminController = load('controllers/admin.controller.js', {
    '../services/admin.service':admin,'../services/audit.service':audit
  });
  const userController = load('controllers/user.controller.js', {
    '../services/user.service':users,'../services/admin.service':admin,
    '../services/quota.service':{}
  });
  const adminRoutes = load('routes/admin.routes.js', {
    express,'../controllers/admin.controller':adminController,
    '../middlewares/auth.middleware':auth,
    '../middlewares/role.middleware':require('../src/middlewares/role.middleware')
  });
  const app = express();
  app.use(express.json());
  app.use('/api/admin',adminRoutes);
  const userRoutes = load('routes/user.routes.js', {
    express,'../middlewares/auth.middleware':auth,'../controllers/user.controller':userController,
    '../controllers/settings.controller':Object.fromEntries(['getPreferences','savePreferences','security','changePassword','logoutOthers'].map(name=>[name,(_,res)=>res.sendStatus(501)]))
  });
  app.use('/api/users',userRoutes);
  app.use(errorHandler);
  const server = app.listen(0,'127.0.0.1');
  await new Promise(resolve => server.once('listening',resolve));
  const request = (route,token,method='GET',body) => fetch(`http://127.0.0.1:${server.address().port}${route}`, {
    method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},
    ...(body === undefined ? {} : {body:JSON.stringify(body)})
  });
  try {
    for (const token of [null,'invalid']) assert.equal((await request('/api/admin/audit-logs',token)).status,401);
    for (const token of ['user','inactive']) {
      for (const route of ['/api/admin/audit-logs','/api/admin/users/2/role','/api/admin/users/2/status']) {
        assert.equal((await request(route,token,route.endsWith('logs')?'GET':'PATCH',route.endsWith('logs')?undefined:{id_rol:2,id_estado:2})).status,403);
      }
    }
    assert.equal((await request('/api/admin/audit-logs','admin')).status,200);
    const profile = await (await request('/api/users/me','user')).json();
    assert.equal(profile.data.id,1);
    assert.equal(profile.data.nombre,'Uno');
    for (const nombre of [null,{},1,' ']) {
      assert.equal((await request('/api/users/me','user','PATCH',{nombre,apellido:'A'})).status,400);
    }
    const updated = await request('/api/users/me','user','PATCH',{
      nombre:' Propio ',apellido:' Nuevo ',id:2,id_usuario:2,id_rol:2,id_estado:2,espacio_usado_by:999
    });
    assert.equal(updated.status,200);
    assert.equal(tables.usuario[0].nombre,'Propio');
    assert.equal(tables.usuario[0].id_rol,1);
    assert.equal(tables.usuario[0].id_estado,1);
    assert.equal(tables.usuario[0].espacio_usado_by,undefined);
    assert.equal(tables.usuario[1].nombre,'Dos');
    assert.equal((await request('/api/admin/users/3/role','admin','PATCH',{id_rol:1})).status,400);
    assert.equal((await request('/api/admin/users/2/role','admin','PATCH',{id_rol:999})).status,400);
    assert.equal((await request('/api/admin/users/2/role','admin','PATCH',{id_rol:2})).status,200);
    assert.equal((await request('/api/admin/users/2/status','admin','PATCH',{id_estado:2})).status,200);
    assert.equal(tables.usuario[1].id_rol,2);
    assert.equal(tables.usuario[1].id_estado,2);
    assert.deepEqual(tables.LogAuditoria.map(r=>r.accion),['CAMBIO_ROL_USUARIO','CAMBIO_ESTADO_USUARIO']);
    assert.ok(tables.LogAuditoria.every(r=>r.id_usuario===3 && r.detalle));
    privilegedDb.fail({message:'INTERNAL_SECURITY_SENTINEL'});
    for (const route of ['/api/admin/audit-logs','/api/admin/overview']) {
      const response = await request(route,'admin');
      assert.equal(response.status,500);
      assert.equal((await response.text()).includes('INTERNAL_SECURITY_SENTINEL'),false);
    }
    privilegedDb.fail(null);
    assert.equal((await request('/api/users/me/deactivate','user','PATCH',{password:'wrong'})).status,401);
    assert.equal((await request('/api/users/me/deactivate','user','PATCH',{password:'valid'})).status,200);
    assert.equal(tables.usuario[0].id_estado,2);
    assert.deepEqual(revocations,['user']);
    assert.equal((await request('/api/users/me','user','PATCH',{nombre:'X',apellido:'Y'})).status,403);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('all legacy admin handlers forward failures to the existing error middleware', async () => {
  const error = new Error('PRIVATE_DATABASE_DETAIL');
  const service = Object.fromEntries(['getOverview','getAllUsers','getAuditLogs','updateUserStatus','updateUserRole']
    .map(name => [name,async () => { throw error; }]));
  const controller = load('controllers/admin.controller.js', {
    '../services/admin.service':service,'../services/audit.service':{}
  });
  for (const method of Object.keys(service)) {
    let forwarded;
    const req = {params:{id:2},body:{id_estado:2,id_rol:2},user:{id:1},query:{}};
    await controller[method](req,{},value => { forwarded=value; });
    assert.equal(forwarded,error,method);
  }
});

test('merged app boots with both phases mounted and authentication intact', async () => {
  const Module = require('node:module');
  const originalLoad = Module._load;
  const keys = ['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SECRET_KEY'];
  const previous = Object.fromEntries(keys.map(key => [key,process.env[key]]));
  const db = database({});
  let app;
  try {
    process.env.SUPABASE_URL = 'http://127.0.0.1:1';
    process.env.SUPABASE_ANON_KEY = 'local-test-placeholder';
    process.env.SUPABASE_SECRET_KEY = 'local-test-placeholder';
    Module._load = function(name,parent,isMain) {
      if (name === '@supabase/supabase-js') return {createClient:() => db};
      return originalLoad.call(this,name,parent,isMain);
    };
    app = require('../src/app');
  } finally {
    Module._load = originalLoad;
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
  const server = app.listen(0,'127.0.0.1');
  await new Promise(resolve => server.once('listening',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(base+'/health')).status,200);
    for (const route of ['/api/notifications','/api/activity','/api/admin/audit-logs',
      '/api/subscriptions/current','/api/payments/history','/api/storage/quota-summary','/api/users/me']) {
      assert.equal((await fetch(base+route)).status,401,route);
    }
    assert.equal((await fetch(base+'/api/plans')).status,200);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
