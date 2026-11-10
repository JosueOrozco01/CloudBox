import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
let sequence=0;
async function setup(){
 const data=new Map([['token','old'],['refreshToken','refresh-old']]);
 globalThis.localStorage={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
 globalThis.window=new EventTarget();
 const source=(await readFile(new URL('../src/services/dashboardService.js',import.meta.url),'utf8')).replace('import { formatFileSize } from "../utils/preferences";','const formatFileSize = String;').replaceAll('import.meta.env?.VITE_API_URL','undefined').replace("'./readCache'", JSON.stringify(new URL('../src/services/readCache.js', import.meta.url).href));
 const module=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${sequence++}`);
 return {module,data};
}
test('two expired requests share one renewal and retry using the new token',async()=>{
 const {module,data}=await setup();let refreshes=0;
 globalThis.fetch=async(url,options)=>{
  if(url.endsWith('/auth/refresh')){refreshes++;await new Promise(resolve=>setTimeout(resolve,15));return Response.json({token:'new',refreshToken:'refresh-new'});}
  return options.headers.get('Authorization')==='Bearer new'?Response.json({success:true}):new Response(null,{status:401});
 };
 const responses=await Promise.all([1,2].map(()=>module.authenticatedFetch('/protected',{headers:{Authorization:'Bearer old'}})));
 assert.equal(refreshes,1);assert.ok(responses.every(response=>response.ok));assert.equal(data.get('refreshToken'),'refresh-new');
});
test('logout during renewal never restores the old session or replays its request',async()=>{
 const {module,data}=await setup();let calls=0;
 globalThis.fetch=async(url)=>{calls++;if(url.endsWith('/auth/refresh')){data.clear();return Response.json({token:'new',refreshToken:'refresh-new'});}return new Response(null,{status:401});};
 const response=await module.authenticatedFetch('/protected',{headers:{Authorization:'Bearer old'}});
 assert.equal(response.status,401);assert.equal(data.get('token'),undefined);assert.equal(calls,2);
});
test('a different account signing in during a failed request cannot receive its retry',async()=>{
 const {module,data}=await setup();let calls=0;
 globalThis.fetch=async()=>{calls++;data.set('token','other-account');data.set('refreshToken','other-refresh');return new Response(null,{status:401});};
 const response=await module.authenticatedFetch('/protected',{headers:{Authorization:'Bearer old'}});
 assert.equal(response.status,401);assert.equal(calls,1);assert.equal(data.get('token'),'other-account');
});
test('API URL configuration is normalized consistently',async()=>{
 const {module}=await setup();assert.equal(module.normalizeApiUrl('https://cloud.example/api/'),'https://cloud.example/api');assert.equal(module.normalizeApiUrl('https://cloud.example/'),'https://cloud.example/api');
});

test('a stale caller cannot reuse cached data from a different account',async()=>{
 const {module,data}=await setup();let calls=0;
 globalThis.fetch=async()=>{calls++;return Response.json({private:true});};
 await module.authenticatedFetch('/cached-private',{headers:{Authorization:'Bearer old'}});
 data.set('token','different-account');
 await assert.rejects(module.authenticatedFetch('/cached-private',{headers:{Authorization:'Bearer old'}}),/La sesión cambió/);
 assert.equal(calls,1);
});
