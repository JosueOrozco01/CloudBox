const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const validation = require('../src/services/input-validation');
const { isOwnedAvatarPath } = require('../src/services/avatar-path');
function load(file, dependencies) {
  const module={exports:{}};
  const filename=path.join(__dirname,'../src',file);
  const localRequire=require('node:module').createRequire(filename);
  vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,exports:module.exports,require:name=>Object.hasOwn(dependencies,name)?dependencies[name]:localRequire(name),process:{env:{}},console,Buffer,Date});
  return module.exports;
}
const response=()=>({statusCode:200,status(code){this.statusCode=code;return this;},json(value){this.body=value;return this;}});

test('verified login completes only its own interrupted profile using catalog IDs',async()=>{
  const rows=[];let factories=0;
  const authUser={id:'own-auth-id',email:'own@example.invalid',user_metadata:{nombre:'Nombre',apellido:'Apellido'}};
  const db={from(table){let filter,inserted;const q={select(){return q;},eq(key,value){filter=[key,value];return q;},insert(value){inserted=value;return q;},single(){return q;},maybeSingle(){return q;},then(resolve,reject){
    if(inserted) {rows.push({id:1,...inserted,estado:{nombre:'Activo'}});return Promise.resolve({data:null,error:null}).then(resolve,reject);}
    const data=table==='rol'?{id:17}:table==='estado_usuario'?{id:23}:rows.find(row=>row[filter[0]]===filter[1]);
    return Promise.resolve({data,error:data?null:{code:'PGRST116'}}).then(resolve,reject);
  }};return q;}};
  const auth=load('services/auth.service.js',{'@supabase/supabase-js':{createClient:()=>db},'../config/session-supabase':()=>{factories++;return {auth:{signInWithPassword:async()=>({data:{user:authUser,session:{access_token:'test-access',refresh_token:'test-refresh'}},error:null})}};}});
  const result=await auth.iniciarSesion({email:'own@example.invalid',password:'Existing123!'});
  assert.equal(result.user.id,1);assert.equal(rows[0].auth_user_id,authUser.id);
  assert.equal(rows[0].id_rol,17);assert.equal(rows[0].id_estado,23);
  await auth.iniciarSesion({email:'own@example.invalid',password:'Existing123!'});
  assert.equal(rows.length,1);assert.equal(factories,2);
});

test('avatar signing checks ownership for profile and administrative consumers',async()=>{
  const signed=[];
  const controller=load('controllers/integrations.controller.js',{'../config/admin-client':{storage:{from:()=>({createSignedUrl:async value=>{signed.push(value);return {data:{signedUrl:'signed'},error:null};}})}}});
  for(const value of ['other/photo.png','owner/../other.png','owner/a/b.png','owner/a\\b.png',{},'owner/\nimage.png']) {
    assert.equal(isOwnedAvatarPath('owner',value),false);
    assert.equal(await controller.avatarUrl({id:'owner',user_metadata:{avatar_path:value}}),null);
  }
  assert.equal(signed.length,0);
  assert.equal(await controller.avatarUrl({id:'owner',user_metadata:{avatar_path:'owner/image.png'}}),'signed');
  assert.deepEqual(signed,['owner/image.png']);
});

test('registration rejects malformed types as 400 and shares the password policy',()=>{
  const middleware=require('../src/middlewares/registration-validation.middleware');
  for(const body of [undefined,{}, {firstName:7}, {firstName:'A',lastName:'B',email:{},password:'Valid123!'}]) {
    let failure;middleware({body},response(),error=>{failure=error;});assert.equal(failure.status,400);
  }
  const req={body:{firstName:' A ',lastName:' B ',email:'A@EXAMPLE.INVALID',password:'Valid123!'}};
  let failure;middleware(req,response(),error=>{failure=error;});assert.equal(failure,undefined);assert.equal(req.body.email,'a@example.invalid');
  for(const value of ['Abcdef12','ABCDEF12!','Abcdef12!'.repeat(20),{},null]) assert.throws(()=>validation.password(value),{status:400});
});

test('file lists fetch all API pages and pending physical deletions remain visible',async()=>{
  const rows=Array.from({length:1051},(_,i)=>({id:i+1,id_usuario:1,id_carpeta:null,id_estado:1,nombre:'file'+i,tamano_bytes:1}));
  rows.push({id:2001,id_usuario:1,id_estado:2},{id:2002,id_usuario:1,id_estado:3,storage_deleted_at:null},{id:2003,id_usuario:1,id_estado:3,storage_deleted_at:'2026-11-03'});
  let pages=0;
  const db={from(){let filters=[],start=0,end=Infinity;const q={select(){return q;},eq(key,value){filters.push(row=>row[key]===value);return q;},is(key,value){filters.push(row=>row[key]===value);return q;},order(){return q;},or(){filters.push(row=>row.id_estado===2||(row.id_estado===3&&row.storage_deleted_at===null));return q;},range(a,b){pages++;start=a;end=Math.min(b,a+136);return q;},then(resolve,reject){return Promise.resolve({data:rows.filter(row=>filters.every(fn=>fn(row))).slice(start,end+1),error:null}).then(resolve,reject);}};return q;}};
  const files=load('services/file.service.js',{'@supabase/supabase-js':{createClient:()=>db},'./folder.service':{}});
  assert.equal((await files.getUserFiles(1)).length,1051);
  assert.ok(pages>8);
  assert.deepEqual(Array.from(await files.getTrashFiles(1),row=>row.id),[2001,2002]);
});

test('failed physical deletion preserves retry and confirmation happens only after Storage succeeds',async()=>{
  const order=[];let unavailable=true;
  const controller=load('controllers/file.controller.js',{
    '../services/file.service':{getFileById:async()=>({id:7,id_estado:2,ruta_storage:'own/file'}),markAsDeleted:async()=>{order.push('mark');return {id:7,id_estado:3,ruta_storage:'own/file'};},confirmStorageDeletion:async()=>{order.push('confirm');}},
    '../services/folder.service':{},'../services/storage.service':{deleteFile:async()=>{order.push('storage');if(unavailable)throw new Error('offline');}},'../services/file-validation.service':{},'../services/quota.service':{syncUsedStorage:async()=>{order.push('quota');}},'../services/activity.service':{},'../services/share.service':{}
  });
  const req={user:{id:1},params:{id:'7'}};
  let res=response();await controller.deleteFilePermanently(req,res,error=>{throw error;});assert.equal(res.statusCode,503);assert.deepEqual(order,['mark','storage']);
  unavailable=false;order.length=0;res=response();await controller.deleteFilePermanently(req,res,error=>{throw error;});assert.equal(res.statusCode,200);assert.deepEqual(order,['mark','storage','confirm','quota']);
  res=response();await controller.getFileById({user:{id:1},params:{id:'7abc'}},res,error=>{throw error;});assert.equal(res.statusCode,400);
});
