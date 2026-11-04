const test = require('node:test');
const assert = require('node:assert/strict');
const { load, database } = require('./helpers');
const validation = require('../src/services/history-validation');
function setup() {
 const tables = {notificacion:[]}; const db = database(tables);
 const service = load('services/notification.service.js', {'@supabase/supabase-js':{createClient:()=>db},'./history-validation':validation});
 return {tables,db,service};
}
test('NOT-01 accepts the seven integrated producer event types',async()=>{
 const {service,tables}=setup();
 for(const type of service.TYPES) {
  const event={recipientUserId:1,type,title:'Aviso',message:'Acción confirmada',deduplicationKey:'resource:1:transition:2'};
  assert.ok(await service.createNotification(event)); assert.equal(await service.createNotification(event),null);
 }
 assert.equal(tables.notificacion.length,7);
});
test('ownership, pagination, unread, idempotent read/all and deletion',async()=>{
 const {service}=setup();
 for(const recipientUserId of [1,1,2]) await service.createNotification({recipientUserId,type:'FILE_SHARED',title:'Archivo',message:'Compartido'});
 assert.equal((await service.listNotifications(1)).length,2);
 assert.equal((await service.listNotifications(1,{limit:1,offset:1})).length,1);
 await assert.rejects(service.markRead(2,1),{status:404}); await assert.rejects(service.deleteNotification(2,1),{status:404});
 const first=await service.markRead(1,1); const stamp=first.fecha_lectura;
 assert.equal((await service.markRead(1,1)).fecha_lectura,stamp);
 assert.equal((await service.listNotifications(1,{},true)).length,1);
 assert.equal((await service.markAllRead(1)).updatedCount,1); assert.equal((await service.markAllRead(1)).updatedCount,0);
 await service.deleteNotification(1,1); await assert.rejects(service.deleteNotification(1,1),{status:404});
});
test('validation rejects malformed parameters, impossible dates and unsafe payloads',async()=>{
 for(const value of ['1x','-1','1.5','',[],{},'9007199254740992']) assert.throws(()=>validation.pagination({offset:value}),{status:400});
 for(const value of ['2026-02-30','2026-13-01','bad',[]]) assert.throws(()=>validation.activityFilters({from:value}),{status:400});
 assert.throws(()=>validation.activityFilters({from:'2026-03-01',to:'2026-01-01'}),{status:400});
 assert.throws(()=>validation.pagination({limit:101}),{status:400});
 const {service}=setup(); await assert.rejects(service.createNotification({recipientUserId:1,type:'BAD',title:'x',message:'x'}),{status:400});
});
test('activity filters preserve own user boundary and stable order',async()=>{
 const db=database({actividad:[{id:1,id_usuario:1,fecha:'2026-10-25T12:00:00.000Z',accion:{nombre:'Subir archivo'}},{id:2,id_usuario:2,fecha:'2026-10-25T12:00:00.000Z',accion:{nombre:'Subir archivo'}},{id:3,id_usuario:1,fecha:'2026-10-25T12:00:00.000Z',accion:{nombre:'Subir archivo'}}]});
 const service=load('services/activity.service.js',{'@supabase/supabase-js':{createClient:()=>db},'./history-validation':validation});
 const rows=await service.getUserActivity(1,{from:'2026-10-25',to:'2026-10-25',action:'Subir archivo',limit:1}); assert.equal(rows[0].id,3);
 assert.equal((await service.getUserActivity(1,{action:"x'),id_usuario.eq.2"})).length,0);
});
test('AUD-01 preserves event signature and swallows storage failure',async()=>{
 const tables={LogAuditoria:[]}; const db=database(tables);
 const {recordLog}=load('services/audit.service.js',{'@supabase/supabase-js':{createClient:()=>db}});
 for(const accion of ['CAMBIO_ESTADO_USUARIO','CAMBIO_ROL_USUARIO','CAMBIO_PLAN','CANCELAR_SUSCRIPCION','REVOCAR_ACCESO']) await recordLog({id_usuario:1,accion,entidad_afectada:'usuario',id_entidad_afectada:2,detalles:{anterior:'Activo',nuevo:'Inactivo'}});
 assert.equal(tables.LogAuditoria.length,5); assert.equal(tables.LogAuditoria[0].id_usuario,1);
 db.fail({message:'unavailable'}); await recordLog({id_usuario:1,accion:'CAMBIO_PLAN'});
});
test('post-commit notification failure does not undo business result',async()=>{
 const {service,db}=setup(); db.fail({message:'offline'});
 assert.equal(await service.notifyAfterCommit({recipientUserId:1,type:'PAYMENT_APPROVED',title:'Pago',message:'Confirmado'}),null);
});
test('admin controller delegates actor context to the service that owns post-commit audit',async()=>{
 const order=[];
 const controller=load('controllers/admin.controller.js',{
  '../services/admin.service':{updateUserStatus:async(id,status,context)=>{order.push('commit');assert.equal(context.currentUserId,1);assert.equal(context.ip_origen,'127.0.0.1');return {id:2};},updateUserRole:async()=>{throw new Error('failed');}},
  '../services/audit.service':{recordLog:async event=>{order.push(event.accion);assert.equal(event.id_usuario,1);}}
 });
 const res=()=>({status(){return this;},json(){return this;}});
 const req={params:{id:'2'},user:{id:1},body:{id_estado:2,id_rol:2},headers:{'x-forwarded-for':'198.51.100.7'},socket:{remoteAddress:'127.0.0.1'}};
 await controller.updateUserStatus(req,res()); assert.deepEqual(order,['commit']);
 await controller.updateUserRole(req,res(),()=>{}); assert.equal(order.length,1);
});
test('admin controller delegates internal errors to the existing sanitized handler',async()=>{
 const controller=load('controllers/admin.controller.js',{'../services/admin.service':{getOverview:async()=>{throw new Error('INTERNAL_SENTINEL');}},'../services/audit.service':{}});
 const res={status(code){this.code=code;return this;},json(body){this.body=body;}};
 let forwarded; await controller.getOverview({},res,error=>{forwarded=error;}); assert.equal(forwarded.message,'INTERNAL_SENTINEL'); assert.equal(res.body,undefined);
});
test('read-all returns exact count even without returned rows',async()=>{
 const {service,tables}=setup();
 tables.notificacion=Array.from({length:1501},(_,i)=>({id:i+1,id_usuario:1,fecha_lectura:null,leida:false}));
 tables.notificacion.push({id:1502,id_usuario:2,fecha_lectura:null,leida:false});
 assert.equal((await service.markAllRead(1)).updatedCount,1501);
 assert.equal(tables.notificacion[1501].fecha_lectura,null);
 assert.equal((await service.markAllRead(1)).updatedCount,0);
});
test('activity date boundaries, pagination and query joins preserve legacy rows',async()=>{
 const db=database({actividad:[
  {id:1,id_usuario:1,fecha:'2026-10-24T23:59:59.999Z',accion:null},
  {id:2,id_usuario:1,fecha:'2026-10-25T00:00:00.000Z',accion:{nombre:'Subir archivo'}},
  {id:3,id_usuario:1,fecha:'2026-10-25T23:59:59.999Z',accion:{nombre:'Subir archivo'}},
  {id:4,id_usuario:1,fecha:'2026-10-26T00:00:00.000Z',accion:{nombre:'Subir archivo'}}
 ]});
 const service=load('services/activity.service.js',{'@supabase/supabase-js':{createClient:()=>db},'./history-validation':validation});
 assert.equal((await service.getUserActivity(1)).length,4);
 assert.equal((await service.getUserActivity(1,{from:'2026-10-25',to:'2026-10-25'})).length,2);
 assert.equal((await service.getUserActivity(1,{from:'2026-10-25',to:'2026-10-25',limit:1,offset:1}))[0].id,2);
});
