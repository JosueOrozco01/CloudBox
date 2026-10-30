'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const policy=require('../src/services/commercial-policy');
function db(tables,cap=137) {
  const calls=[];
  return {calls,fail:null,from(table) {
    let filters=[],start=0,end=Infinity,single=false,values,inserting=false;
    const q={select(){return q;},eq(k,v){filters.push(r=>r[k]==v);return q;},in(k,vs){filters.push(r=>vs.includes(r[k]));return q;},
      gte(k,v){filters.push(r=>r[k]>=v);return q;},lte(k,v){filters.push(r=>r[k]<=v);return q;},
      order(){return q;},range(a,b){start=a;end=b;return q;},or(v){calls.push({or:v});return q;},
      update(v){values=v;return q;},insert(v){values=v;inserting=true;return q;},single(){single=true;return q;},maybeSingle(){single=true;return q;},
      then(resolve,reject){return Promise.resolve().then(()=>{
        calls.push({table,start,values});
        if(thisDb.fail?.(table,start))return {data:null,error:{message:'DATABASE_SENTINEL'}};
        if(inserting)(tables[table]||=[]).push({id:Math.max(0,...tables[table].map(r=>r.id))+1,...values});
        const rows=(tables[table]||[]).filter(r=>filters.every(f=>f(r)));
        if(inserting)return {data:rows.at(-1),error:null};
        if(values)rows.forEach(r=>Object.assign(r,values));
        const page=rows.slice(start,Math.min(end+1,start+cap));
        return {data:single?(page[0]||null):page,count:rows.length,error:null};
      }).then(resolve,reject);}};
    const thisDb=this;return q;
  }};
}
function load(name,database) {
  const module={exports:{}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/services',name),'utf8'),{
    module,exports:module.exports,require:spec=>spec==='@supabase/supabase-js'?{createClient:()=>database}:require(path.resolve(__dirname,'../src/services',spec)),
    process:{env:{SUPABASE_URL:'http://127.0.0.1:1',SUPABASE_SERVICE_ROLE_KEY:'local-placeholder'}},console:{error(){}},Date,Number,Map
  });return module.exports;
}
const free={id:42,nombre:' Free ',precio:0,espacio_maximo_gb:1,vigencia_dias:36500,id_estado:1};
const today=policy.utcDay(),tomorrow=policy.utcDay(new Date(Date.now()+86400000));

test('UTC civil dates include the contracted last day and exclude future starts',async()=>{
  assert.equal(policy.utcDay(new Date('2026-10-27T20:00:00-06:00')),'2026-10-28');
  const data=db({suscripcion:[{id:1,id_usuario:1,id_plan:1,id_estado:2,fecha_inicio:today,fecha_fin:today}],
    plan:[{id:1,nombre:'Básico',precio:29,espacio_maximo_gb:5}],estado_suscripcion:[{id:2,nombre:'Activa'}]});
  const service=load('subscription.service.js',data);
  assert.equal((await service.getCurrent(1)).id,1);
  assert.equal(service.daysRemaining(today),0); // Full days after today, not an expiry predicate.
  assert.equal(policy.isCurrent({fecha_inicio:tomorrow,fecha_fin:tomorrow}),false);
  for(const status of ['Cancelada','Renovada','Vencida','Pendiente'])
    assert.equal(service.normalize({fecha_inicio:today,fecha_fin:tomorrow},free,status).daysRemaining,0);
});

test('quota counts every page, preserves trash, and shares canonical Free fallback in all upload contracts',async()=>{
  const files=Array.from({length:1001},(_,i)=>({id:i+1,id_usuario:1,id_estado:i%2+1,tamano_bytes:i===1000?100*1024**2:1024**2}));
  files.push({id:2000,id_usuario:1,id_estado:3,tamano_bytes:999999999});
  const data=db({archivo:files,usuario:[{id:1},{id:2}],plan:[free],estado_archivo:[{id:1,nombre:'Activo'},{id:2,nombre:'En papelera'}],estado_suscripcion:[{id:2,nombre:'Activa'},{id:3,nombre:'PorVencer'}],suscripcion:[]});
  const service=load('quota.service.js',data);
  const summary=await service.getQuotaSummary(1);
  assert.equal(summary.espacio_usado_bytes,1100*1024**2);
  assert.equal(summary.plan_actual.id,42);assert.equal(summary.bloqueo_subida,true);
  assert.equal((await service.canUserUpload({userId:1,incomingSizeBytes:1})).allowed,false);
  await assert.rejects(service.validateUpload(1,1),{status:413});
  assert.equal((await service.canUserUpload({userId:2,incomingSizeBytes:1})).allowed,true);
  assert.equal((await service.validateUpload(2,1)).maxBytes,1024**3);
  assert.ok(data.calls.filter(c=>c.values).every(c=>Object.keys(c.values).join()==='espacio_usado_by'));
  data.fail=table=>table==='archivo';await assert.rejects(service.getQuotaSummary(2));
});

test('missing Free never fabricates an id or permits an upload',async()=>{
  const service=load('quota.service.js',db({estado_suscripcion:[{id:2,nombre:'Activa'}],suscripcion:[],plan:[]}));
  await assert.rejects(service.validateUpload(1,1),{code:'FREE_PLAN_UNAVAILABLE',status:503});
});

test('reports aggregate beyond max_rows and fail on any missing page',async()=>{
  const count=2301,tables={usuario:[],suscripcion:[],archivo:[],pago:[]};
  for(let i=1;i<=count;i++){
    tables.usuario.push({id:i,id_estado:1});tables.archivo.push({id:i,id_estado:1,nombre:'x.pdf',tamano_bytes:10});
    tables.pago.push({id:i,id_estado:1,monto:'0.01',fecha_pago:today});
    tables.suscripcion.push({id:i,id_estado:2,fecha_inicio:i===1?tomorrow:today,fecha_fin:tomorrow});
  }
  const data=db(tables),service=load('admin.service.js',data);
  const stats=await service.getGeneralStats();assert.equal(stats.totalUsuarios,count);assert.equal(stats.totalSuscripcionesActivas,count-1);
  assert.equal(stats.ingresosTotales,23.01);assert.equal(stats.almacenamientoUsadoBytes,23010);
  assert.equal((await service.getStorageMetrics()).totalArchivos,count);
  assert.equal((await service.getRevenueReport({startDate:today,endDate:today})).totalTransacciones,count);
  data.fail=(table,start)=>table==='pago'&&start>=137;
  await assert.rejects(service.getGeneralStats());await assert.rejects(service.getRevenueReport());
  await assert.rejects(service.getRevenueReport({startDate:'2026-02-30'}),{status:400});
});

test('admin pagination preserves requested empty pages and rejects invalid status and fractional pages',async()=>{
  const data=db({estado_suscripcion:[{id:2,nombre:'Activa'}],suscripcion:Array.from({length:21},(_,i)=>({id:i+1,id_estado:2}))});
  const service=load('admin.service.js',data);
  const empty=await service.getAllSubscriptions({page:3,limit:20});assert.equal(empty.pagination.currentPage,3);assert.equal(empty.pagination.totalRecords,21);
  await assert.rejects(service.getAllSubscriptions({status:'inventado'}),{status:400});
  await assert.rejects(service.getUsersList({page:1.5}),{status:400});
  data.fail=table=>table==='estado_suscripcion';await assert.rejects(service.getAllSubscriptions());
});

test('user status filters use the real FK, and failed subscription enrichment is never hidden',async()=>{
  const tables={estado_usuario:[{id:1,nombre:'Activo'}],usuario:[{id:1,id_estado:1,espacio_usado_by:17},{id:2,id_estado:2}],
    estado_suscripcion:[{id:2,nombre:'Activa'}],suscripcion:[{id:1,id_usuario:1,id_plan:1,id_estado:2}],plan:[{id:1}]};
  const data=db(tables),service=load('admin.service.js',data);
  const users=await service.getUsersList({status:'Activo'});
  assert.equal(users.pagination.totalRecords,1);assert.equal(users.users[0].espacio_usado_bytes,17);
  await assert.rejects(service.getUsersList({status:'inexistente'}),{status:400});
  data.fail=table=>table==='plan';await assert.rejects(service.getAllSubscriptions());
});

test('referenced plan terms are immutable and Free stays Q0 / 1 GB / active',async()=>{
  const plan={id:1,nombre:'Básico',precio:29,espacio_maximo_gb:5,vigencia_dias:30,id_estado:1};
  const data=db({plan:[plan,free],suscripcion:[{id:1,id_plan:1}]});const service=load('plan.service.js',data);
  for(const patch of [{precio:100},{vigencia_dias:60},{espacio_maximo_gb:9}])await assert.rejects(service.updatePlan(1,patch),{status:409,code:'PLAN_TERMS_IMMUTABLE'});
  for(const patch of [{precio:1},{nombre:'Otro'},{espacio_maximo_gb:2}])await assert.rejects(service.updatePlan(42,patch),{status:409});
  await assert.rejects(service.setPlanStatus(42,2),{status:409});
  assert.equal(data.calls.filter(c=>c.values).length,0);
  assert.equal((await service.updatePlan(1,{descripcion:'Descripción actualizada'})).precio,29);
  const version=await service.createPlan({nombre:'Básico nueva tarifa',precio:35,espacio_maximo_gb:5,vigencia_dias:30});
  assert.equal(version.precio,35);assert.notEqual(version.id,1);
  assert.equal((await service.updatePlan(version.id,{precio:36})).precio,36);
  await assert.rejects(service.createPlan({nombre:'Inválido',precio:1,espacio_maximo_gb:1,vigencia_dias:0}),{status:400});
});

test('checkout and lifecycle expose commercial conflicts as 409, not service outages',async()=>{
  for(const message of ['CLOUDBOX_PENDING_ACTION_EXISTS','CLOUDBOX_SAME_PLAN_REQUIRES_RENEWAL','CLOUDBOX_CHANGE_PLAN_REQUIRED']){
    const checkout=load('subscription-checkout.service.js',{rpc:async()=>({error:{code:'P0001',message}})});
    await assert.rejects(checkout.subscribePaid(1,{planId:2,paymentMethodId:1,referenceCode:'COMMERCIAL01'}),{status:409});
  }
  const lifecycle=load('subscription-lifecycle.service.js',{});
  assert.equal(lifecycle.toDomainError({message:'CLOUDBOX_SAME_PRICE_CHANGE_NOT_SUPPORTED'}).status,409);
  assert.equal(lifecycle.toDomainError({message:'CLOUDBOX_PENDING_ACTION_EXISTS'}).status,409);
});
