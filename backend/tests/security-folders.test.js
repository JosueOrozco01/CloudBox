const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const {load,database} = require('./helpers');
const errorHandler = require('../src/middlewares/error-handler.middleware');

test('folder routes preserve owners, internal service calls and audit; RPC implementation remains doubled', async () => {
  const tables = {
    usuario:[{id:1,auth_user_id:'user',id_rol:1,id_estado:1}],
    rol:[{id:1,nombre:'Cliente'}],estado_usuario:[{id:1,nombre:'Activo'}],
    carpeta:[{id:10,nombre:'Propia',id_usuario:1,id_padre:null,id_estado:1},
      {id:20,nombre:'Ajena',id_usuario:2,id_padre:null,id_estado:1}]
  };
  const db = database(tables), calls=[], audit=[], activity=[];
  const from = db.from;
  db.from = table => {
    const query=from(table);
    if (table==='carpeta') {
      const insert=query.insert;
      query.insert=rows=>insert(rows.map(row=>({id_estado:1,...row})));
    }
    return query;
  };
  let rpcError=null;
  db.rpc = async (name,args) => {
    calls.push({name,args:{...args}});
    if (rpcError) return {data:null,error:{message:rpcError}};
    const own=tables.carpeta.find(f=>f.id===args.p_carpeta_id && f.id_usuario===args.p_usuario_id);
    if (!own) return {data:null,error:{message:name==='eliminar_carpeta_cascada'?'Carpeta no encontrada o sin permisos':'No existe una eliminación pendiente'}};
    // Doble de contrato: no simula la implementacion SQL ni la cascada real.
    return {data:{success:true,id_carpeta:own.id},error:null};
  };
  const folders = load('services/folder.service.js',{'@supabase/supabase-js':{createClient:()=>db}});
  const controller = load('controllers/folder.controller.js',{
    '../services/folder.service':folders,'../services/file.service':{},
    '../services/activity.service':{ACTIONS:{CREATE_FOLDER:'CREAR_CARPETA',DELETE_FOLDER:'ELIMINAR_CARPETA'},recordActivity:async event=>activity.push(event)},
    '../services/share.service':{validateFolderAccess:async()=>({hasAccess:false})}
  });
  const auth = load('middlewares/auth.middleware.js',{
    '../config/supabase':{auth:{getUser:async token=>({data:{user:{id:token}},error:null})}},
    '../config/authenticated-supabase':()=>db
  });
  const clientActivity = load('middlewares/client-activity.middleware.js',{
    '../services/audit.service':{recordLog:async event=>audit.push(event)}
  });
  const routes=load('routes/folder.routes.js',{express,
    '../controllers/folder.controller':controller,'../middlewares/auth.middleware':auth,
    '../middlewares/client-activity.middleware':clientActivity});
  const app=express();app.use(express.json());app.use('/api/folders',routes);app.use(errorHandler);
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const request=(route,method='GET',body,token='user')=>fetch(`http://127.0.0.1:${server.address().port}/api/folders${route}`,{
    method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},
    ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
  try {
    assert.equal((await request('','GET',undefined,null)).status,401);
    const roots=await (await request('')).json();assert.deepEqual(roots.data.map(f=>f.id),[10]);
    assert.equal((await request('/20','PUT',{nombre:'Intrusion'})).status,403);
    assert.equal((await request('','POST',{nombre:'Intrusion',id_padre:20})).status,403);
    assert.equal(audit.length,0);
    const created=await request('','POST',{nombre:' Prueba ',id_padre:10,id_usuario:2,id_estado:2});
    assert.equal(created.status,201);const folder=(await created.json()).data;
    assert.equal(folder.id_usuario,1);assert.equal(folder.id_estado,1);assert.equal(folder.nombre,'Prueba');
    assert.equal((await request(`/${folder.id}`,'PUT',{nombre:'Renombrada'})).status,200);
    const beforeMove={...tables.carpeta.find(f=>f.id===folder.id)};
    const deniedMove=await request(`/${folder.id}/move`,'PATCH',{id_padre:20});
    assert.equal(deniedMove.status,403);
    assert.deepEqual(await deniedMove.json(),{success:false,code:'EDITOR_PERMISSION_REQUIRED',message:'La carpeta destino no existe o no tienes permisos.'});
    assert.deepEqual(tables.carpeta.find(f=>f.id===folder.id),beforeMove);
    assert.equal((await request(`/${folder.id}/move`,'PATCH',{id_padre:null})).status,200);
    assert.equal((await request('/10/move','PATCH',{id_padre:10})).status,400);
    const count=calls.length;
    assert.equal((await request('/invalid','DELETE')).status,400);
    assert.equal((await request('/0/restore','PATCH')).status,400);assert.equal(calls.length,count);
    assert.equal((await request('/20','DELETE')).status,404);
    assert.equal((await request('/20/restore','PATCH')).status,404);
    assert.equal((await request(`/${folder.id}`,'DELETE')).status,200);
    assert.equal((await request(`/${folder.id}/restore`,'PATCH')).status,200);
    assert.deepEqual(calls.slice(-2),[
      {name:'eliminar_carpeta_cascada',args:{p_carpeta_id:folder.id,p_usuario_id:1}},
      {name:'restaurar_carpeta_cascada',args:{p_carpeta_id:folder.id,p_usuario_id:1}}
    ]);
    assert.deepEqual(audit.map(e=>e.accion),['CREAR_CARPETA','ELIMINAR_CARPETA']);
    assert.ok(audit.every(e=>e.id_usuario===1 && e.entidad_afectada==='carpeta'));
    assert.deepEqual(activity.map(e=>e.userId),[1,1]);
    rpcError='INTERNAL_RPC_DETAIL';
    for (const [route,method] of [[`/${folder.id}`,'DELETE'],[`/${folder.id}/restore`,'PATCH']]) {
      const response=await request(route,method);assert.equal(response.status,500);
      assert.equal((await response.text()).includes('INTERNAL_RPC_DETAIL'),false);
    }
    assert.equal(audit.length,2);
    rpcError='mismo nombre';assert.equal((await request(`/${folder.id}/restore`,'PATCH')).status,409);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});

test('legacy folder handlers sanitize every internal failure through the existing error middleware', async () => {
  const handlers = ['getUserFolders','getFolderById','createFolder','updateFolderName','getSubfolders','getFolderContent','moveFolder'];
  const folderMethods = ['getUserRootFolders','getFolderById','createFolder','validateFolderOwnership'];
  const sanitized = load('middlewares/error-handler.middleware.js', {multer:{MulterError:class extends Error {}}});
  for (const status of [undefined,500,503]) {
    for (const method of handlers) {
      const failure=new Error('INTERNAL_FOLDER_QUERY_SENTINEL');
      if (status) failure.status=status;
      const folders=Object.fromEntries(folderMethods.map(name=>[name,async()=>{throw failure;}]));
      const controller=load('controllers/folder.controller.js',{
        '../services/folder.service':folders,'../services/file.service':{},
        '../services/activity.service':{},'../services/share.service':{}
      });
      const req={params:{id:'10'},user:{id:1},body:{nombre:'Nombre',id_padre:null}};
      const res={status(value){this.code=value;return this;},json(body){this.body=body;return this;}};
      let forwarded;
      await controller[method](req,res,error=>{forwarded=error;sanitized(error,req,res,()=>{});});
      assert.equal(forwarded,failure,method);
      assert.equal(res.code,status||500,method);
      assert.equal(res.body.message,'No se pudo completar la operación. Inténtalo nuevamente.',method);
      assert.equal(JSON.stringify(res.body).includes('INTERNAL_FOLDER_QUERY_SENTINEL'),false,method);
    }
  }
});

test('folder public validation and sharing error contracts remain unchanged', async () => {
  const cases=[
    ['createFolder','createFolder',new Error('El nombre de la carpeta no puede estar vacío.'),400],
    ['updateFolderName','getFolderById',new Error('Ya existe una carpeta con ese nombre en esta ubicación.'),400],
    ['moveFolder','getFolderById',new Error('No puedes mover una carpeta dentro de sus subcarpetas.'),400],
    ['getFolderById','getFolderById',Object.assign(new Error('Acceso compartido expirado'),{status:403,code:'SHARE_EXPIRED'}),403]
  ];
  for (const [method,dependency,error,status] of cases) {
    const controller=load('controllers/folder.controller.js',{
      '../services/folder.service':{[dependency]:async()=>{throw error;}},
      '../services/file.service':{},'../services/activity.service':{},'../services/share.service':{}
    });
    const req={params:{id:'10'},user:{id:1},body:{nombre:'Nombre',id_padre:null}};
    const res={status(value){this.code=value;return this;},json(body){this.body=body;return this;}};
    await controller[method](req,res,()=>assert.fail('Public error must retain its contract'));
    assert.equal(res.code,status);assert.equal(res.body.message,error.message);
    if (error.code) assert.equal(res.body.code,error.code);
  }
});
