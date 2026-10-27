'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const renameSql = fs.readFileSync(path.join(__dirname,'../../supabase/migrations/20261025050000_renombrar_tablas_suscripcion.sql'),'utf8');
const sql = fs.readFileSync(path.join(__dirname,'../../supabase/migrations/20261025030000_subscription_policy_v2.sql'),'utf8');

test('migración es transaccional y conserva firmas RPC públicas existentes',()=>{
 assert.match(sql,/BEGIN;/);
 assert.match(sql,/COMMIT;/);
 for(const name of ['cloudbox_subscription_change_v1','cloudbox_subscription_cancel_v1','cloudbox_subscription_expire_v1']) {
   assert.match(sql,new RegExp('CREATE OR REPLACE FUNCTION public\\.'+name+'\\('));
 }
});
test('programación y crédito tienen persistencia propia y unicidad',()=>{
 for(const name of ['credito_suscripcion','evento_credito_suscripcion','programacion_suscripcion']) assert.ok(renameSql.includes(name),name);
 for(const name of ['cloudbox_schedule_one_pending_per_user','cloudbox_credit_reference_unique']) assert.ok(sql.includes(name),name);
});
test('funciones protegidas de acceso público y service role permitido',()=>{
 assert.match(sql,/REVOKE ALL ON FUNCTION[\s\S]+FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION[\s\S]+TO service_role/);
});
test('pago cero se registra como asiento sin crear pago ficticio',()=>{
 assert.match(sql,/IF v_due>0 THEN/);
 assert.match(renameSql,/INSERT INTO public\.evento_credito_suscripcion/);
});
test('cancelación se programa sin reemplazo instantáneo de plan',()=>{
 const start=sql.indexOf('CREATE OR REPLACE FUNCTION public.cloudbox_subscription_cancel_v1');
 const end=sql.indexOf('$function$;',start);
 const text=sql.slice(start,end);
 assert.match(text,/fecha_efectiva/);
 assert.doesNotMatch(text,/INSERT INTO public\.suscripcion/);
});
