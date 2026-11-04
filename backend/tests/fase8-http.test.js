const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { load, database } = require('./helpers');
const validation = require('../src/services/history-validation');
const errorHandler = require('../src/middlewares/error-handler.middleware');
test('HTTP routes use real auth/roles with local Supabase doubles', async () => {
 const db=database({notificacion:[],actividad:[{id:1,id_usuario:1,fecha:'2026-10-25T00:00:00.000Z',accion:{nombre:'Subir archivo'}},{id:2,id_usuario:2,fecha:'2026-10-25T00:00:00.000Z',accion:{nombre:'Subir archivo'}}]});
 const service=load('services/notification.service.js',{'@supabase/supabase-js':{createClient:()=>db},'./history-validation':validation});
 await service.createNotification({recipientUserId:1,type:'FILE_SHARED',title:'Aviso',message:'Compartido'});
 const auth=load('middlewares/auth.middleware.js',{
  '../config/supabase':{auth:{getUser:async token=>token==='invalid'?{data:{},error:{}}:{data:{user:{id:token}},error:null}}},
  '../config/authenticated-supabase':token=>({from(table){return {select(){return this;},eq(){return this;},async single(){return {data:table==='usuario'?{id:token==='other'?2:1,auth_user_id:token,id_rol:1,id_estado:1}:table==='rol'?{nombre:token==='admin'?'Administrador':'Cliente'}:{nombre:token==='inactive'?'Inactivo':'Activo'}};}};}})
 });
 const controller=load('controllers/notification.controller.js',{'../services/notification.service':service,'../services/history-validation':validation});
 const routes=load('routes/notification.routes.js',{'express':express,'../controllers/notification.controller':controller,'../middlewares/auth.middleware':auth});
 const app=express(); app.use('/api/notifications',routes);
 const roles=require('../src/middlewares/role.middleware');
 const adminController = Object.fromEntries(['getOverview','getAllUsers','updateUserStatus','updateUserRole','getAuditLogs','getStats','getUsers','getStorageMetrics','getSubscriptions','getRevenue'].map(name=>[name,(req,res)=>res.json({success:true})]));
 const adminRoutes=load('routes/admin.routes.js',{'express':express,'./report.routes':express.Router(),'../controllers/integrations.controller':Object.fromEntries(['reads','markReads','userCatalog'].map(name=>[name,(_,res)=>res.json({success:true,data:[]})])),'../controllers/admin.controller':{...adminController,...Object.fromEntries(['getStorageOverview','getStorageUsers','getUsersOverQuota','getUserById'].map(name=>[name,(_,res)=>res.json({success:true})]))},'../middlewares/auth.middleware':auth,'../middlewares/role.middleware':roles});
 app.use('/api/admin',adminRoutes);
 const activityService=load('services/activity.service.js',{'@supabase/supabase-js':{createClient:()=>db},'./history-validation':validation});
 const activity=load('controllers/activity.controller.js',{'../services/activity.service':activityService});
 const activityRoutes=load('routes/activity.routes.js',{'express':express,'../controllers/activity.controller':activity,'../middlewares/auth.middleware':auth});
 app.use('/api/activity',activityRoutes); app.use(errorHandler);
 const server=app.listen(0,'127.0.0.1'); await new Promise(resolve=>server.once('listening',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 const request=(route,token,method='GET')=>fetch(base+route,{method,headers:token?{Authorization:`Bearer ${token}`}:{}});
 try {
  for(const token of [null,'invalid']) assert.equal((await request('/api/notifications',token)).status,401);
  assert.equal((await request('/api/notifications','inactive')).status,403);
  assert.equal((await request('/api/activity',null)).status,401);
  assert.equal((await request('/api/activity','inactive')).status,403);
  assert.equal((await request('/api/admin/audit-logs',null)).status,401);
  const history=await (await request('/api/activity?userId=2&from=2026-10-25&to=2026-10-25&action=Subir%20archivo','user')).json();
  assert.equal(history.success,true); assert.equal(history.data.length,1); assert.equal(history.data[0].id_usuario,1);
  assert.equal((await request('/api/activity?from=2026-02-30','user')).status,400);
  assert.equal((await request('/api/activity?limit=101','user')).status,400);
  assert.equal((await request('/api/notifications/999/read','user','PATCH')).status,404);
  assert.equal((await request('/api/notifications/invalid/read','user','PATCH')).status,400);
  assert.equal((await request('/api/admin/audit-logs','user')).status,403);
  assert.equal((await request('/api/admin/audit-logs','admin')).status,200);
  assert.equal((await request('/api/notifications/1/read','other','PATCH')).status,404);
  assert.equal((await request('/api/notifications/1','other','DELETE')).status,404);
  const listed=await (await request('/api/notifications?userId=2','user')).json(); assert.equal(listed.data.length,1); assert.equal(listed.data[0].id_usuario,1);
  assert.equal((await request('/api/notifications?limit=1x','user')).status,400);
  assert.equal((await request('/api/notifications/read-all','user','PATCH')).status,200);
  assert.equal((await request('/api/notifications/unread','user')).status,200);
  assert.equal((await request('/api/notifications/1/read','user','PATCH')).status,200);
  const removed=await request('/api/notifications/1','user','DELETE'); assert.equal(removed.status,204); assert.equal(await removed.text(),'');
  db.fail({message:'secret database detail'});
  const failed=await request('/api/notifications','user'); assert.equal(failed.status,500); assert.equal((await failed.text()).includes('secret'),false);
  const activityError=await request('/api/activity','user'); assert.equal(activityError.status,500); assert.equal((await activityError.text()).includes('secret'),false);
 } finally { await new Promise(resolve=>server.close(resolve)); }
});
