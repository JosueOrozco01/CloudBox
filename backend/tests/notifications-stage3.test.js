const test=require('node:test'),assert=require('node:assert/strict');
const {load,database}=require('./helpers');
const validation=require('../src/services/history-validation');

test('notification client is server-to-server and never persists end-user sessions',()=>{
 let options;
 load('services/notification.service.js',{'@supabase/supabase-js':{createClient:(_url,_key,value)=>{options=value;return database({});}},'./history-validation':validation});
 assert.equal(options.auth.persistSession,false);
 assert.equal(options.auth.autoRefreshToken,false);
 assert.equal(options.auth.detectSessionInUrl,false);
});

test('leida is authoritative; legacy reads, unknown types, 255-char titles and missing read dates are preserved',async()=>{
 const tables={notificacion:[
  {id:1,id_usuario:10,titulo:'x'.repeat(255),mensaje:'Histórico',tipo:'ANTIGUO',leida:true,fecha_creacion:'2026-01-01',fecha_lectura:null},
  {id:2,id_usuario:10,titulo:'Sin leer',mensaje:'Histórico',tipo:null,leida:false,fecha_creacion:'2026-01-02',fecha_lectura:null},
  {id:3,id_usuario:20,titulo:'Ajena',leida:false,fecha_creacion:'2026-01-02',fecha_lectura:null}
 ]};
 const db=database(tables),service=load('services/notification.service.js',{'@supabase/supabase-js':{createClient:()=>db},'./history-validation':validation});
 const unread=await service.listNotifications(10,{},true);assert.deepEqual(unread.map(r=>r.id),[2]);
 assert.equal((await service.markRead(10,1)).fecha_lectura,null);
 const read=await service.markRead(10,2);assert.equal(read.leida,true);assert.equal(read.read,true);assert.ok(read.fecha_lectura);
 assert.equal((await service.markRead(10,2)).fecha_lectura,read.fecha_lectura);
 assert.equal((await service.listNotifications(10))[1].titulo.length,255);
 assert.equal((await service.markAllRead(10)).updatedCount,0);
 await assert.rejects(service.markRead(20,1),{status:404});await assert.rejects(service.deleteNotification(20,1),{status:404});
 await assert.rejects(service.markRead(10,'2147483648'),{status:400});
});

test('persistent dedup survives deletion, including resource identity and recipient',async()=>{
 const tables={notificacion:[]},db=database(tables),service=load('services/notification.service.js',{'@supabase/supabase-js':{createClient:()=>db},'./history-validation':validation});
 const event={recipientUserId:10,type:'FILE_SHARED',title:'x'.repeat(255),message:'Confirmado',resourceType:'archivo',resourceId:5,deduplicationKey:'share:1'};
 const created=await service.createNotification(event);assert.equal(created.id_recurso,5);assert.equal(created.id_usuario,10);
 await service.deleteNotification(10,created.id);assert.equal(await service.createNotification(event),null);
 assert.ok(await service.createNotification({...event,recipientUserId:20}));
 assert.ok(await service.createNotification({...event,deduplicationKey:'share:2'}));
 db.fail({message:'PRIVATE_SENTINEL'});assert.equal(await service.notifyAfterCommit({...event,deduplicationKey:'share:3'}),null);
});

test('activity uses business identity, strict pagination/UTC bounds, and keeps orphan action rows without filtering',async()=>{
 const db=database({actividad:[{id:1,id_usuario:10,accion:null,fecha:'2026-01-01T00:00:00.000Z'},
   {id:2,id_usuario:20,accion:{nombre:'Subir archivo'},fecha:'2026-01-01T10:00:00.000Z'}]});
 const activity=load('services/activity.service.js',{'@supabase/supabase-js':{createClient:()=>db},'./history-validation':validation});
 assert.equal((await activity.getUserActivity(10,{from:'2026-01-01',to:'2026-01-01'})).length,1);
 assert.equal((await activity.getUserActivity(10,{action:'Subir archivo'})).length,0);
 await assert.rejects(activity.getUserActivity('10x'),{status:400});
 await assert.rejects(activity.getUserActivity(10,{offset:-1}),{status:400});
 db.fail({message:'PRIVATE_SENTINEL'});await assert.rejects(activity.getUserActivity(10),e=>!e.message.includes('PRIVATE_SENTINEL'));
});

test('administrative plan changes, cancellation and revocation audit only after confirmed operations',async()=>{
 const events=[],order=[],audit={recordLog:async event=>{order.push('audit');events.push(event);}};
 const plan=load('controllers/plan.controller.js',{'../services/plan.service':{
   createPlan:async()=>{order.push('commit');return {id:9};},updatePlan:async()=>{throw new Error('rejected');},setPlanStatus:async()=>({id:9})
 },'../services/audit.service':audit});
 const res={status(){return this;},json(){return this;}};
 const req={user:{id:10},body:{},params:{id:9},ip:'127.0.0.1'};
 await plan.createPlan(req,res);assert.deepEqual(order,['commit','audit']);assert.equal(events[0].accion,'CREAR_PLAN');
 let failure;await plan.updatePlan(req,res,error=>failure=error);assert.equal(failure.message,'rejected');assert.equal(events.length,1);
 const cancellation=load('controllers/subscription.controller.js',{
   '../services/subscription.service':{},'../services/subscription-lifecycle.service':{cancel:async()=>({success:true,scheduled:true,subscriptionId:4,effectiveOn:'2026-11-01'})},'../services/audit.service':audit
 });
 await cancellation.cancel(req,res);assert.equal(events[1].accion,'CANCELAR_SUSCRIPCION');assert.equal(events[1].detalles.scheduled,true);
 const shares=load('controllers/share.controller.js',{
   '../services/share.service':{revokeShare:async input=>{assert.equal(input.actorUserId,10);return {id:9};}},
   '../services/activity.service':{},'../services/audit.service':audit
 });
 await shares.revokeShare(req,res);assert.equal(events[2].accion,'REVOCAR_ACCESO');assert.equal(events[2].id_usuario,10);
});
