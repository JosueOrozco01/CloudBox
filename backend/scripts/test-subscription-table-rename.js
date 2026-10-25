'use strict';
// Local PostgreSQL integration only. No .env or Supabase connection.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const container = 'cloudbox-rename-validation';
const dbName='rename_test_'+Date.now();
const conflictDb=dbName+'_conflict', driftDb=dbName+'_drift', unknownDb=dbName+'_unknown';
const run = args => execFileSync('docker', args, { encoding:'utf8',stdio:['pipe','pipe','pipe'] });
const info=JSON.parse(run(['inspect',container]))[0];
assert.equal(info.Config.Image,'postgres:17');
assert.equal(info.HostConfig.NetworkMode,'none');
assert.ok(!info.HostConfig.Binds?.length);
assert.ok(info.Mounts.every(m=>m.Type==='volume' && /^[a-f0-9]{64}$/.test(m.Name) && m.Destination==='/var/lib/postgresql/data'));
const sql=(text,db=dbName)=>execFileSync('docker',['exec','-i',container,'psql','-X','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1','-Atq'],{input:text,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const forward=read('supabase/migrations/20261025050000_renombrar_tablas_suscripcion.sql');
const rollback=read('supabase/rollbacks/20261025050000_renombrar_tablas_suscripcion.sql');
function rejected(text,db,pattern){
 try {sql(text,db);} catch(error) {if (!error.stderr) throw error; assert.match(String(error.stderr),pattern);return;}
 throw new Error('Expected SQL failure: '+pattern);
}
const names=['cloudbox_subscription_credit','cloudbox_subscription_credit_event','cloudbox_subscription_schedule'];
const targets=['credito_suscripcion','evento_credito_suscripcion','programacion_suscripcion'];
const snapshot=tableNames=>sql(`SELECT jsonb_build_object(
 'credit',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id_usuario) FROM public.${tableNames[0]} t),
 'events',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.${tableNames[1]} t),
 'schedules',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.${tableNames[2]} t));`);
function metadata(oids){return sql(`SELECT jsonb_build_object(
 'tables',(SELECT jsonb_agg(jsonb_build_array(oid,relacl,relrowsecurity,relforcerowsecurity) ORDER BY oid) FROM pg_class WHERE oid IN (${oids})),
 'constraints',(SELECT jsonb_agg(to_jsonb(t) ORDER BY oid) FROM pg_constraint t WHERE conrelid IN (${oids}) OR confrelid IN (${oids})),
 'indexes',(SELECT jsonb_agg(to_jsonb(t) ORDER BY indexrelid) FROM pg_index t WHERE indrelid IN (${oids})),
 'policies',(SELECT jsonb_agg(to_jsonb(t) ORDER BY oid) FROM pg_policy t WHERE polrelid IN (${oids})),
 'sequences',(SELECT jsonb_agg(to_jsonb(t) ORDER BY seqrelid) FROM pg_sequence t),
 'functions',(SELECT jsonb_agg(jsonb_build_array(oid,proowner,proacl,proconfig,prosecdef,prorettype,proargtypes::text) ORDER BY oid) FROM pg_proc WHERE pronamespace='public'::regnamespace),
 'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY oid) FROM pg_trigger t WHERE NOT tgisinternal));`);}
async function concurrent(text){
 return new Promise(resolve=>{
  const p=spawn('docker',['exec','-i',container,'psql','-X','-U','postgres','-d',dbName,'-v','ON_ERROR_STOP=1','-Atq']);
  let out='',err='';p.stdout.on('data',v=>out+=v);p.stderr.on('data',v=>err+=v);
  p.on('error',error=>resolve({code:-1,out,err:String(error)}));
  p.on('close',code=>resolve({code,out,err}));p.stdin.end(text);
 });
}
(async()=>{
 sql(`CREATE DATABASE ${dbName};`,'postgres');
 sql(read('backend/tests/sql/subscription-schema.sql'));
 // Supplied snapshot already has receipts/identity. Do not reapply the historical
 // receipts migration: SET DEFAULT on an existing identity is a separate legacy issue.
 for(const file of ['20261024000000_payment_engine.sql','20261024020000_free_subscription.sql','20261025010000_subscription_checkout_atomic.sql','20261025020000_subscription_lifecycle.sql','20261025030000_subscription_policy_v2.sql']) sql(read('supabase/migrations/'+file));
 sql(`INSERT INTO public.cloudbox_subscription_credit VALUES(101,3.25,now());
 INSERT INTO public.cloudbox_subscription_credit_event(id_usuario,monto_generado,monto_aplicado,saldo_resultante,referencia) VALUES(101,3.25,0,3.25,'BEFORE_RENAME');
 INSERT INTO public.cloudbox_subscription_schedule(id_usuario,id_suscripcion_origen,tipo,id_plan_destino,fecha_efectiva)
 SELECT 109,id,'cancel',8,fecha_fin FROM public.suscripcion WHERE id_usuario=109;
 ALTER TABLE public.cloudbox_subscription_credit ENABLE ROW LEVEL SECURITY;
 CREATE POLICY local_preservation_probe ON public.cloudbox_subscription_credit FOR SELECT USING(id_usuario=101);
 CREATE TABLE public.rename_fk_probe(id_usuario integer REFERENCES public.cloudbox_subscription_credit(id_usuario));
 INSERT INTO public.rename_fk_probe VALUES(101);
 CREATE VIEW public.rename_view_probe AS SELECT id_usuario,saldo FROM public.cloudbox_subscription_credit;`);
 const before=snapshot(names);
 const oids=sql(`SELECT string_agg(to_regclass('public.'||name)::oid::text,',') FROM unnest(ARRAY['${names.join("','")}']) name;`);
 const beforeMeta=metadata(oids);
 for(const db of [conflictDb,driftDb,unknownDb])sql(`CREATE DATABASE ${db} TEMPLATE ${dbName};`,'postgres');
 sql('CREATE VIEW public.credito_suscripcion AS SELECT 1 AS id;',conflictDb);
 rejected(forward,conflictDb,/Conflicto/);
 assert.equal(sql("SELECT count(*) FROM pg_class WHERE relname IN ('cloudbox_subscription_credit','cloudbox_subscription_credit_event','cloudbox_subscription_schedule');",conflictDb),'3');
 sql("CREATE OR REPLACE FUNCTION public.cloudbox_subscription_cancel_v1(p_user_id integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN RETURN '{}'::jsonb; END; $$;",driftDb);
 rejected(forward,driftDb,/Funcion ausente o distinta/);
 sql("CREATE FUNCTION public.extra_dependency() RETURNS bigint LANGUAGE sql AS $$ SELECT count(*) FROM public.cloudbox_subscription_credit $$;",unknownDb);
 rejected(forward,unknownDb,/funciones adicionales/);
 console.log('PASS preflight: target conflict, function drift and additional dependency abort atomically');
 sql(forward);
 assert.equal(snapshot(targets),before);assert.equal(metadata(oids),beforeMeta);
 assert.equal(sql('SELECT saldo FROM public.rename_view_probe WHERE id_usuario=101;'),'3.25');
 assert.equal(sql("SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND prosrc ~ 'cloudbox_subscription_(credit|schedule)';"),'0');
 assert.equal(sql("SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relname IN ('cloudbox_subscription_credit','cloudbox_subscription_credit_event','cloudbox_subscription_schedule');"),'0');
 sql("SET ROLE service_role; SELECT count(*) FROM public.credito_suscripcion; RESET ROLE;");
 rejected('SET ROLE authenticated; SELECT * FROM public.credito_suscripcion;',dbName,/permission denied/);
 rejected('SET ROLE anon; SELECT * FROM public.credito_suscripcion;',dbName,/permission denied/);
 rejected('SET ROLE authenticated; SELECT public.cloudbox_subscription_cancel_v1(101);',dbName,/permission denied/);
 rejected('INSERT INTO public.credito_suscripcion(id_usuario,saldo) VALUES(9999,0);',dbName,/foreign key/);
 rejected('UPDATE public.credito_suscripcion SET saldo=-1 WHERE id_usuario=101;',dbName,/check constraint/);
 rejected("INSERT INTO public.evento_credito_suscripcion(id_usuario,referencia) VALUES(101,'BEFORE_RENAME');",dbName,/unique constraint/);
 rejected('INSERT INTO public.rename_fk_probe VALUES(102);',dbName,/foreign key/);
 rejected(forward,dbName,/Falta tabla origen/);
 assert.equal(snapshot(targets),before);
 console.log('PASS rename: rows, OIDs, FKs, checks, uniqueness, indexes, sequences, ACL, policies, RLS and RPC signatures preserved; repeat rejected without changes');
 sql(`BEGIN;
 DO $test$ DECLARE r jsonb; last_id integer; BEGIN
 r:=public.cloudbox_subscribe_paid_v1(110,1,1,'RENAMEBUY110',false);
 IF (r->>'success')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'checkout: %',r; END IF;
 r:=public.cloudbox_subscription_renew_v1(110,1,'RENAMERENEW110',false);
 IF (r->>'success')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'renew: %',r; END IF;
 r:=public.cloudbox_subscribe_paid_v1(111,1,1,'RENAMEBUY111',false);
 UPDATE public.suscripcion SET fecha_fin=CURRENT_DATE+120 WHERE id_usuario=111 AND id_estado=2;
 r:=public.cloudbox_subscription_change_v1(111,2,1,'RENAMEZERO111',false);
 IF (r->>'amountDue')::numeric<>0 OR (r->>'remainingCredit')::numeric<>27 THEN RAISE EXCEPTION 'credit carry: %',r; END IF;
 IF EXISTS(SELECT 1 FROM public.pago WHERE referencia='RENAMEZERO111') THEN RAISE EXCEPTION 'zero payment created'; END IF;
 r:=public.cloudbox_subscription_change_v1(102,2,1,'RENAMEUP102',false);
 IF (r->>'creditGenerated')::numeric<>14.50 OR (r->>'amountDue')::numeric<>74.50 THEN RAISE EXCEPTION 'credit: %',r; END IF;
 r:=public.cloudbox_subscription_change_v1(103,2,1,'RENAMEFAIL103',true);
 IF r->>'code'<>'PAYMENT_DECLINED' THEN RAISE EXCEPTION 'decline: %',r; END IF;
 r:=public.cloudbox_subscription_change_v1(104,2,1,'RENAMEUP104',false);
 r:=public.cloudbox_subscription_change_v1(104,1,1,'RENAMEDOWN104',false);
 IF (r->>'scheduled')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'downgrade: %',r; END IF;
 UPDATE public.suscripcion SET fecha_fin=CURRENT_DATE-1 WHERE id_usuario=104 AND id_estado=2;
 UPDATE public.programacion_suscripcion SET fecha_efectiva=CURRENT_DATE-1 WHERE id_usuario=104;
 r:=public.cloudbox_subscription_cancel_v1(105);
 BEGIN
   PERFORM public.cloudbox_subscription_renew_v1(105,1,'RENAMEBLOCK105',false);
   RAISE EXCEPTION 'renewal bypassed pending schedule';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%CLOUDBOX_PENDING_ACTION_EXISTS%' THEN RAISE; END IF; END;
 UPDATE public.suscripcion SET fecha_fin=CURRENT_DATE-1 WHERE id_usuario=105 AND id_estado=2;
 UPDATE public.programacion_suscripcion SET fecha_efectiva=CURRENT_DATE-1 WHERE id_usuario=105;
 r:=public.cloudbox_subscription_expire_v1();
 IF (SELECT id_plan FROM public.suscripcion WHERE id_usuario=105 AND id_estado IN (2,3))<>8 THEN RAISE EXCEPTION 'cancel did not activate Free'; END IF;
 IF (SELECT id_plan FROM public.suscripcion WHERE id_usuario=104 AND id_estado IN (2,3))<>1 THEN RAISE EXCEPTION 'downgrade not applied'; END IF;
 r:=public.cloudbox_subscription_expire_v1();
 IF (SELECT count(*) FROM public.suscripcion WHERE id_usuario IN (104,105) AND id_estado IN (2,3))<>2 THEN RAISE EXCEPTION 'worker duplicated subscription'; END IF;
 END $test$;
 ROLLBACK;`);
 console.log('PASS RPC execution: checkout, renewal, upgrade/credit, rejection, downgrade, cancellation, pending trigger, worker and repeated worker');
 // Synchronize on the actual database lock, not an assumed scheduler delay.
 const first=concurrent("BEGIN; SET LOCAL application_name='cloudbox_rename_race'; SELECT id FROM public.usuario WHERE id=108 FOR UPDATE; SELECT pg_sleep(4); SELECT public.cloudbox_subscription_change_v1(108,2,1,'RENAMERACE108A',false); COMMIT;");
 let locked=false;
 for(let i=0;i<40;i++){
  if(sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='cloudbox_rename_race' AND wait_event='PgSleep';")==='1'){locked=true;break;}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 assert.ok(locked,'first session must hold the lock before second session');
 const second=concurrent("SELECT public.cloudbox_subscription_change_v1(108,2,1,'RENAMERACE108B',false);");
 const [a,b]=await Promise.all([first,second]);assert.equal(a.code,0,a.err);assert.notEqual(b.code,0);assert.match(b.err,/CLOUDBOX_SAME_PLAN_REQUIRES_RENEWAL/);
 assert.equal(sql("SELECT count(*) FROM public.suscripcion WHERE id_usuario=108 AND id_estado IN (2,3);"),'1');
 assert.equal(sql("SELECT count(*) FROM public.pago WHERE referencia IN ('RENAMERACE108A','RENAMERACE108B');"),'1');
 assert.equal(sql("SELECT count(*) FROM public.evento_credito_suscripcion WHERE referencia IN ('RENAMERACE108A','RENAMERACE108B');"),'1');
 console.log('PASS concurrent sessions: one active subscription, one payment and one credit event');
 const beforeRollback=snapshot(targets);sql(rollback);assert.equal(snapshot(names),beforeRollback);
 rejected(rollback,dbName,/Falta tabla origen/);
 // Prove rollback functions work in a fresh connection and reapplication is supported.
 sql("BEGIN; SELECT public.cloudbox_subscription_cancel_v1(107); ROLLBACK;");
 sql(forward);assert.equal(snapshot(targets),beforeRollback);
 console.log('PASS rollback after writes: rows preserved, RPC executes, repeat rollback safe failure, forward reapplies');
 console.log('ALL LOCAL POSTGRESQL TESTS PASSED. Auth stub; no production/Supabase API/E2E certification.');
})().catch(error=>{console.error(error.stderr?String(error.stderr):error);process.exitCode=1;});
