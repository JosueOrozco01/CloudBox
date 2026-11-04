const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function load(file,deps){const module={exports:{}};const source=path.join(__dirname,'../src',file);const localRequire=require('node:module').createRequire(source);vm.runInNewContext(fs.readFileSync(source,'utf8'),{module,exports:module.exports,require:name=>Object.hasOwn(deps,name)?deps[name]:localRequire(name),Buffer,console,Date,process:{env:{}}});return module.exports;}
function db(){
 const tables={support_ticket:[{id:1,id_usuario:1,status:'open',subject:'Ayuda'},{id:2,id_usuario:2,status:'closed',subject:'Otro usuario'}],support_message:[],LogAuditoria:[{id:1},{id:2}],admin_notification_read:[]};
 return {tables,from(table){let filters=[],single=false,operation='select',values,start=0,end=Infinity;const q={select(){return q;},eq(k,v){filters.push(row=>row[k]===v);return q;},in(k,v){filters.push(row=>v.includes(row[k]));return q;},order(){return q;},range(a,b){start=a;end=b;return q;},maybeSingle(){single=true;return q;},insert(v){operation='insert';values=v;return q;},upsert(v){operation='upsert';values=v;return q;},update(v){operation='update';values=v;return q;},then(resolve,reject){return Promise.resolve().then(()=>{const rows=tables[table]||=[];if(operation==='insert')rows.push({id:rows.length+1,...values});if(operation==='upsert')for(const value of values){if(!rows.some(row=>row.id_usuario===value.id_usuario&&row.id_log===value.id_log))rows.push(value);}let selected=rows.filter(row=>filters.every(filter=>filter(row)));if(operation==='update')selected.forEach(row=>Object.assign(row,values));return {data:single?selected[0]||null:selected.slice(start,end+1),count:selected.length,error:null};}).then(resolve,reject);}};return q;},async rpc(name,values){assert.equal(name,'cloudbox_create_ticket');const ticket={id:3,id_usuario:values.p_user,subject:values.p_subject,category:values.p_category,status:'open'};tables.support_ticket.push(ticket);tables.support_message.push({ticket_id:3,id_usuario:values.p_user,message:values.p_message});return {data:3,error:null};}};
}
async function call(handler,req){let status=200,payload,error;await handler({params:{},query:{},body:{},user:{id:1,role:'Cliente'},...req},{status(value){status=value;return this;},json(value){payload=value;}},value=>{error=value;});return {status,payload,error};}
function setup(){const database=db();const c=load('controllers/integrations.controller.js',{'../config/admin-client':database,'node:crypto':require('node:crypto')});return {database,c};}
test('ticket access cannot be redirected to another user via ids or query parameters',async()=>{
 const {c}=setup();const result=await call(c.ticketDetail,{params:{id:2}});assert.equal(result.error.status,404);
 const listed=await call(c.tickets,{query:{userId:2}});assert.equal(listed.payload.data.length,1);assert.equal(listed.payload.data[0].id_usuario,1);
 const admin=await call(c.ticketDetail,{params:{id:2},user:{id:9,role:'Administrador'}});assert.equal(admin.payload.data.id,2);
});
test('tickets create initial messages atomically, reject invalid text, and restrict status changes',async()=>{
 const {c,database}=setup();assert.equal((await call(c.createTicket,{body:{subject:'a',message:'hola',category:'files'}})).error.status,400);
 const created=await call(c.createTicket,{body:{subject:'Necesito ayuda',message:'No puedo abrir mi archivo',category:'files'}});assert.equal(created.status,201);assert.equal(database.tables.support_message.length,1);
 assert.equal((await call(c.ticketStatus,{params:{id:1},body:{status:'in_progress'}})).error.status,403);
 await call(c.ticketStatus,{params:{id:1},body:{status:'closed'}});assert.equal((await call(c.reply,{params:{id:1},body:{message:'respuesta'}})).error.status,400);
 await call(c.ticketStatus,{params:{id:1},body:{status:'open'},user:{id:9,role:'Administrador'}});assert.equal(database.tables.support_ticket[0].status,'open');
});
test('administrative reads persist per administrator, are idempotent and never delete audit records',async()=>{
 const {c,database}=setup();assert.equal((await call(c.markReads,{body:{ids:[-1]}})).error.status,400);
 await call(c.markReads,{body:{ids:[1,2,999]},user:{id:9,role:'Administrador'}});await call(c.markReads,{body:{ids:[1]},user:{id:9,role:'Administrador'}});
 assert.equal(database.tables.admin_notification_read.length,2);assert.equal(database.tables.LogAuditoria.length,2);
 assert.equal((await call(c.reads,{user:{id:10,role:'Administrador'}})).payload.data.length,0);assert.equal((await call(c.reads,{user:{id:9,role:'Administrador'}})).payload.data.length,2);
});
test('avatar rejects missing files, executable payloads and spoofed MIME before writing storage',async()=>{
 const {c}=setup();assert.equal((await call(c.avatar,{})).error.status,400);
 assert.equal((await call(c.avatar,{file:{mimetype:'image/png',buffer:Buffer.from('<script>malicious</script>')}})).error.status,400);
 const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(8)]);assert.equal((await call(c.avatar,{file:{mimetype:'image/jpeg',buffer:png}})).error.status,400);
});
test('storage report aggregates more than 100 users without the public pagination cap',async()=>{
 const users=Array.from({length:250},(_,i)=>({id:i+1,overQuota:i>200,porcentaje_uso:90}));
 const service=load('services/report.service.js',{'@supabase/supabase-js':{createClient:()=>({})},'./admin-storage.service':{getStorageOverview:async()=>({espacio_total_bytes:250*1024**3,espacio_total_gb:250,total_archivos:250,total_carpetas:250}),getStorageUsers:async options=>{assert.equal(options.all,true);return {users};}},pdfkit:null});
 const report=await service.getStorageReport();assert.equal(report.promedioPorUsuario.gb,1);assert.equal(report.alertasCuota.totalSobreCuota,49);assert.equal(report.alertasCuota.totalProximosCuota,201);
});
const express=require('express');
test('HTTP support and administrative read routes enforce authentication and admin role',async()=>{
 const {c}=setup();const app=express();app.use(express.json());
 const auth=(req,res,next)=>{const token=req.headers.authorization;if(!token)return res.status(401).json({message:'Sesión requerida'});req.user={id:token==='admin'?9:token==='other'?2:1,role:token==='admin'?'Administrador':'Cliente'};next();};
 const support=load('routes/support.routes.js',{express,'../middlewares/auth.middleware':auth,'../controllers/integrations.controller':c});app.use('/support',support);
 const role=require('../src/middlewares/role.middleware');app.get('/reads',auth,role(['Administrador']),c.reads);app.patch('/reads',auth,role(['Administrador']),c.markReads);
 app.use((error,req,res,next)=>res.status(error.status||500).json({message:error.status?error.message:'Error interno'}));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const url=`http://127.0.0.1:${server.address().port}`;
 const request=(route,token,body,method)=>fetch(url+route,{method:method||(body?'POST':'GET'),headers:{...(token?{Authorization:token}:{}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 try{
  assert.equal((await request('/support')).status,401);
  assert.equal((await request('/support/2','user')).status,404);
  assert.equal((await request('/support/2','admin')).status,200);
  assert.equal((await request('/reads','user')).status,403);
  assert.equal((await request('/reads','admin',{ids:[1]},'PATCH')).status,200);
  assert.deepEqual((await (await request('/reads','admin')).json()).data,[1]);
  assert.equal((await request('/support/1/messages','user',{message:''})).status,400);
  assert.equal((await request('/support/1/messages','user',{message:'Necesito ayuda'})).status,201);
  assert.equal((await request('/support/1/status','user',{status:'in_progress'},'PATCH')).status,403);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
test('renewal validates refresh tokens, rejects revoked sessions and enforces active accounts',async()=>{
 let shouldFail=false,active=true;
 const c=load('controllers/auth-extra.controller.js',{'../config/session-supabase':()=>({auth:{refreshSession:async()=>shouldFail?{error:{},data:{}}:{data:{session:{access_token:'renewed',refresh_token:'rotated'}}}}}),'../middlewares/auth.middleware':(req,res,next)=>active?next():res.status(403).json({message:'Cuenta inactiva'}),'../services/auth.service':{resendEmailConfirmation:async()=>{}}});
 assert.equal((await call(c.refresh,{body:{refreshToken:'bad'}})).status,400);
 let result=await call(c.refresh,{headers:{},body:{refreshToken:'valid-refresh'}});assert.equal(result.payload.token,'renewed');
 shouldFail=true;assert.equal((await call(c.refresh,{headers:{},body:{refreshToken:'valid-refresh'}})).status,401);
 shouldFail=false;active=false;assert.equal((await call(c.refresh,{headers:{},body:{refreshToken:'valid-refresh'}})).status,403);
});
test('verification resends validate addresses and throttle repeated requests',async()=>{
 let sent=0;
 const c=load('controllers/auth-extra.controller.js',{'../config/session-supabase':()=>({}),'../middlewares/auth.middleware':()=>{},'../services/auth.service':{resendEmailConfirmation:async()=>{sent++;}}});
 assert.equal((await call(c.resend,{body:{email:'invalid'}})).status,400);
 assert.equal((await call(c.resend,{ip:'127.0.0.1',body:{email:'persona@example.com'}})).status,200);
 assert.equal((await call(c.resend,{ip:'127.0.0.1',body:{email:'persona@example.com'}})).status,429);assert.equal(sent,1);
});
test('storage CSV exports all 250 accounts instead of stopping at 100',async()=>{
 const users=Array.from({length:250},(_,i)=>({id_usuario:i+1,nombre_completo:`Persona ${i+1}`,correo:`persona${i+1}@example.com`,espacio_usado_bytes:1,maxBytes:100,porcentaje_uso:1,cantidad_archivos:1,cantidad_carpetas:0,overQuota:false}));
 const service=load('services/report.service.js',{'@supabase/supabase-js':{createClient:()=>({})},'./admin-storage.service':{getStorageUsers:async options=>{assert.equal(options.all,true);return {users};}},pdfkit:null});
 const result=await service.exportReport({type:'storage',format:'csv'});assert.equal(result.data.trim().split(/\r?\n/).length,251);assert.match(result.data,/persona250@example.com/);
});
test('private avatar updates keep existing metadata and clean up failed replacement uploads',async()=>{
 const uploaded=[],removed=[],updated=[];let reject=false;
 const bucket={upload:async(path,buffer,options)=>{uploaded.push(path);assert.equal(options.contentType,'image/png');return {data:{path},error:null};},remove:async paths=>{removed.push(...paths);return {data:[],error:null};},createSignedUrl:async path=>({data:{signedUrl:`https://example.test/private/${path}?temporary=1`},error:null})};
 const database={storage:{from:name=>{assert.equal(name,'avatars');return bucket;}},auth:{admin:{updateUserById:async(id,value)=>{updated.push(value.user_metadata);return reject?{error:new Error('failed')}:{data:{user:{id}},error:null};}}}};
 const c=load('controllers/integrations.controller.js',{'../config/admin-client':database,'node:crypto':require('node:crypto')});
 const req={user:{id:1,authUserId:'auth-1',role:'Cliente'},authUser:{user_metadata:{avatar_path:'auth-1/previous.png',other:'preserved'}},file:{mimetype:'image/png',buffer:Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(8)])}};
 const result=await call(c.avatar,req);assert.equal(result.status,200);assert.match(result.payload.data.avatarUrl,/temporary=1/);assert.equal(updated[0].other,undefined,'Unchanged metadata is merged by Auth, never resent from a stale request.');assert.ok(uploaded[0].startsWith('auth-1/'));assert.deepEqual(removed,['auth-1/previous.png']);
 removed.length=0;reject=true;assert.ok((await call(c.avatar,req)).error);assert.equal(removed[0],uploaded[1]);assert.equal(removed.includes('auth-1/previous.png'),false);
});
