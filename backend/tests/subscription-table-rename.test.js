'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const historical = fs.readFileSync(path.join(root, 'supabase/migrations/20261025030000_subscription_policy_v2.sql'), 'utf8').replace(/\r\n/g, '\n');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20261025050000_renombrar_tablas_suscripcion.sql'), 'utf8');
const rollback = fs.readFileSync(path.join(root, 'supabase/rollbacks/20261025050000_renombrar_tablas_suscripcion.sql'), 'utf8');
const pairs = [['cloudbox_subscription_credit_event','evento_credito_suscripcion'],['cloudbox_subscription_credit','credito_suscripcion'],['cloudbox_subscription_schedule','programacion_suscripcion']];
const rename = text => pairs.reduce((s,[a,b]) => s.replace(new RegExp('\\b'+a+'\\b','g'),b),text);
const functions = text => [...text.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(([\s\S]*?)\$function\$([\s\S]*?)\$function\$;/g)];
test('rename preserves every affected function definition except table identifiers', () => {
 const affected = functions(historical).filter(m => pairs.some(([name]) => m[3].includes(name)));
 assert.equal(affected.length,4);
 for (const entry of affected) {
  assert.ok(migration.includes(rename(entry[0])),entry[1]);
  assert.ok(rollback.includes(entry[0]),entry[1]);
 }
 assert.equal(functions(migration).length,affected.length);
});
test('forward and rollback rename in a transaction without recreating tables',()=>{
 for (const sql of [migration,rollback]) {
  assert.match(sql,/BEGIN;/); assert.match(sql,/COMMIT;/);
  assert.doesNotMatch(sql,/\b(?:DROP|CREATE) TABLE\b/i);
  assert.match(sql,/Funcion ausente o distinta/);
  assert.match(sql,/Hay funciones adicionales/);
 }
 for (const [oldName,newName] of pairs) {
  assert.ok(migration.includes(`ALTER TABLE public.${oldName} RENAME TO ${newName};`));
  assert.ok(rollback.includes(`ALTER TABLE public.${newName} RENAME TO ${oldName};`));
 }
});
test('runtime backend and frontend contain no queries against old table names',()=>{
 function visit(dir) { return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?visit(path.join(dir,e.name)):[path.join(dir,e.name)]); }
 for(const folder of ['backend/src','frontend/src']) for(const file of visit(path.join(root,folder)).filter(f=>/\.(js|jsx|ts|tsx)$/.test(f))) {
  const content=fs.readFileSync(file,'utf8');
  for(const [oldName] of pairs) assert.equal(content.includes(oldName),false,path.relative(root,file));
 }
});
