'use strict';
// Only an isolated PostgreSQL fixture. Never loads .env, historical migrations or stage 2 SQL.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync,spawn}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),container='cloudbox-notifications-stage3',db='notifications_'+Date.now();
const emptyDb=db+'_empty';
const info=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0];
assert.equal(info.Config.Image,'postgres:17');assert.equal(info.Config.Labels?.['cloudbox.task'],'notifications-stage3');
assert.equal(info.HostConfig.NetworkMode,'none');assert.ok(!info.HostConfig.Binds?.length);
assert.ok(info.Mounts.every(m=>m.Type==='volume'&&/^[a-f0-9]{64}$/.test(m.Name)&&m.Destination==='/var/lib/postgresql/data'));
const args=['exec','-i',container,'psql','-X','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1','-Atq'];
const sql=(input,database=db)=>execFileSync('docker',[...args.slice(0,8),database,...args.slice(9)],{input,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const patch=read('supabase/manual/notifications/20261027_etapa3.sql');
assert.doesNotMatch(patch,/CREATE OR REPLACE FUNCTION public.cloudbox_(?:subscription|assign_free|subscribe_paid)/);
let checks=0;
function equal(input,want){assert.equal(sql(input),want);checks++;}
function denied(input,pattern=/permission denied/){assert.throws(()=>sql(input),e=>pattern.test(String(e.stderr)));checks++;}
function session(input){
 const child=spawn('docker',args);let out='',err='',signal;const ready=new Promise(resolve=>signal=resolve);
 const done=new Promise((resolve,reject)=>{child.stdout.on('data',v=>{out+=v;if(out.includes('HELD'))signal();});child.stderr.on('data',v=>err+=v);child.on('error',reject);child.on('close',code=>resolve({out,err,code}));});
 child.stdin.end(input);return {ready,done};
}
function timeout(){return new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('Readiness timeout')),15000);timer.unref();});}
const emit=key=>`SELECT public.cloudbox_notification_create_v1(10,'FILE_SHARED','Seguro','Confirmado','archivo',1,'${key}');`;
const snapshot=()=>sql(`SELECT jsonb_build_object('notifs',(SELECT jsonb_agg(to_jsonb(n) ORDER BY id) FROM public.notificacion n),
 'events',(SELECT jsonb_agg(to_jsonb(e) ORDER BY id_usuario,tipo,clave) FROM public.cloudbox_notification_event e));`);
(async()=>{
 try{
  sql(`CREATE DATABASE ${db};`,'postgres');sql(read('backend/tests/sql/notifications-real-schema.sql'));
  // Dependency witness: verified real Free behavior, without replacing it in the patch.
  sql(`CREATE FUNCTION public.cloudbox_assign_free_after_user_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
    DECLARE v_free_id integer; BEGIN
    SELECT id INTO v_free_id FROM public.plan WHERE lower(btrim(nombre))='free' AND precio=0 AND espacio_maximo_gb=1 AND id_estado=1 ORDER BY id LIMIT 1;
    IF v_free_id IS NULL THEN RAISE WARNING 'Free no disponible'; RETURN NEW; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.suscripcion WHERE id_usuario=NEW.id) THEN
      INSERT INTO public.suscripcion(id_usuario,id_plan,id_estado,fecha_inicio,fecha_fin) VALUES(NEW.id,v_free_id,2,CURRENT_DATE,CURRENT_DATE+36500) ON CONFLICT DO NOTHING;
    END IF;RETURN NEW; END $$;
    CREATE TRIGGER cloudbox_user_free_subscription_after_insert AFTER INSERT ON public.usuario FOR EACH ROW EXECUTE FUNCTION public.cloudbox_assign_free_after_user_insert();`);
  const freeHash=sql("SELECT md5(prosrc) FROM pg_proc WHERE oid='public.cloudbox_assign_free_after_user_insert()'::regprocedure;");
  const legacy=sql('SELECT jsonb_agg(to_jsonb(n) ORDER BY id) FROM public.notificacion n;');
  const inspectBefore=JSON.parse(sql(read('supabase/manual/notifications/20261027_inspeccion.sql')));
  assert.equal(inspectBefore.counts.total,2);checks++;
  const oid=sql("SELECT 'public.notificacion'::regclass::oid;");
  sql(patch);sql(patch);
  equal("SELECT 'public.notificacion'::regclass::oid;",oid);
  equal("SELECT jsonb_agg(to_jsonb(n)-'fecha_lectura'-'tipo_recurso'-'id_recurso' ORDER BY id) FROM public.notificacion n WHERE id IN(1,2);",legacy);
  equal('SELECT (leida AND fecha_lectura IS NULL)::text FROM public.notificacion WHERE id=1;','true');
  equal("SELECT md5(prosrc) FROM pg_proc WHERE oid='public.cloudbox_assign_free_after_user_insert()'::regprocedure;",freeHash);
  // The exact inspected zero-row state: no extensions/ledger/functions/triggers yet.
  sql(`CREATE DATABASE ${emptyDb};`,'postgres');
  sql(read('backend/tests/sql/notifications-real-schema.sql'),emptyDb);
  sql('DELETE FROM public.notificacion;',emptyDb); // Only synthetic fixture rows.
  const emptyOid=sql("SELECT 'public.notificacion'::regclass::oid;",emptyDb);
  const sequenceBefore=sql('SELECT last_value FROM public.notificacion_id_seq;',emptyDb);
  sql(patch,emptyDb);
  assert.equal(sql('SELECT count(*) FROM public.notificacion;',emptyDb),'0');checks++;
  assert.equal(sql("SELECT 'public.notificacion'::regclass::oid;",emptyDb),emptyOid);checks++;
  assert.equal(sql('SELECT last_value FROM public.notificacion_id_seq;',emptyDb),sequenceBefore);checks++;
  assert.equal(sql("SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgname IN ('cloudbox_not_share','cloudbox_not_payment','cloudbox_not_subscription','cloudbox_not_storage');",emptyDb),'4');checks++;
  sql(read('supabase/manual/notifications/20261027_verificacion.sql'),emptyDb);checks++;
  // Missing catalog entries must not turn SQL NULL comparisons into a false activation.
  sql(`UPDATE public.estado_suscripcion SET nombre='No disponible' WHERE nombre='PorVencer';
    INSERT INTO public.suscripcion(fecha_inicio,fecha_fin,id_usuario,id_plan,id_estado) VALUES(CURRENT_DATE,CURRENT_DATE+30,10,1,1);`,emptyDb);
  assert.equal(sql('SELECT count(*) FROM public.notificacion;',emptyDb),'0');checks++;
  assert.equal(sql('SELECT count(*) FROM public.suscripcion;',emptyDb),'1');checks++;
  const inspectAfter=JSON.parse(sql(read('supabase/manual/notifications/20261027_inspeccion.sql')));
  assert.equal(inspectAfter.counts.read_without_timestamp,inspectBefore.counts.read_without_timestamp);checks++;
  sql(read('supabase/manual/notifications/20261027_verificacion.sql'));checks++;
  for(const role of ['anon','authenticated']){
    denied(`SET ROLE ${role}; SELECT * FROM public.notificacion;`);
    denied(`SET ROLE ${role}; ${emit('forbidden')}`);
    denied(`SET ROLE ${role}; SELECT * FROM public.cloudbox_notification_event;`);
    denied(`SET ROLE ${role}; UPDATE public.usuario SET id_rol=2 WHERE id=10;`);
    denied(`SET ROLE ${role}; UPDATE public.usuario SET id_estado=2 WHERE id=10;`);
    denied(`SET ROLE ${role}; UPDATE public.estado_carpeta SET nombre='x' WHERE id=1;`);
    equal(`SET ROLE ${role}; SELECT count(*) FROM public.estado_carpeta;`,'2');
    denied(`SET ROLE ${role}; SELECT * FROM public."LogAuditoria";`);
  }
  equal("SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000010'; UPDATE public.usuario SET nombre='Propio' WHERE id=10 RETURNING nombre;",'Propio');
  equal("SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000010'; UPDATE public.usuario SET nombre='Ajeno' WHERE id=20 RETURNING nombre;",'');
  // All seven producers are reached through the business tables, including cron-like transitions.
  sql(`SET ROLE service_role;
    INSERT INTO public.compartir(id_archivo,id_usuario_emisor,id_usuario_receptor,id_permiso,id_estado) VALUES(1,20,10,2,1);
    INSERT INTO public.compartir(id_carpeta,id_usuario_emisor,id_usuario_receptor,id_permiso,id_estado) VALUES(1,20,10,2,1);
    UPDATE public.compartir SET id_estado=2 WHERE id=1;
    INSERT INTO public.suscripcion(fecha_inicio,fecha_fin,id_usuario,id_plan,id_estado) VALUES(CURRENT_DATE,CURRENT_DATE+5,10,1,2);
    INSERT INTO public.pago(monto,id_metodo_pago,id_suscripcion,id_estado,id_usuario) VALUES(29,1,1,1,10);
    UPDATE public.suscripcion SET id_estado=3 WHERE id=1;
    UPDATE public.usuario SET espacio_usado_by=4831838208 WHERE id=10;`);
  equal("SELECT string_agg(tipo,',' ORDER BY tipo) FROM public.notificacion WHERE id_usuario=10 AND tipo<>'TIPO_ANTIGUO';",
    'ACCESS_REVOKED,FILE_SHARED,FOLDER_SHARED,PAYMENT_APPROVED,STORAGE_NEAR_LIMIT,SUBSCRIPTION_ACTIVATED,SUBSCRIPTION_EXPIRING');
  equal('SELECT count(*) FROM public.notificacion WHERE id_usuario=20;','1');
  equal("SELECT (tipo_recurso='archivo' AND id_recurso=1)::text FROM public.notificacion WHERE tipo='FILE_SHARED';",'true');
  const once=snapshot();
  sql('UPDATE public.compartir SET id_estado=2 WHERE id=1; UPDATE public.pago SET id_estado=1 WHERE id=1; UPDATE public.suscripcion SET id_estado=3 WHERE id=1; UPDATE public.usuario SET espacio_usado_by=4831838208 WHERE id=10;');
  assert.equal(snapshot(),once);checks++;
  sql("DELETE FROM public.notificacion WHERE tipo='STORAGE_NEAR_LIMIT'; UPDATE public.usuario SET espacio_usado_by=4831838208 WHERE id=10;");
  equal("SELECT count(*) FROM public.notificacion WHERE tipo='STORAGE_NEAR_LIMIT';",'0');
  sql('UPDATE public.compartir SET id_estado=1 WHERE id=1; UPDATE public.compartir SET id_estado=2 WHERE id=1;');
  equal("SELECT count(*) FROM public.notificacion WHERE tipo='FILE_SHARED';",'2');
  equal("SELECT count(*) FROM public.notificacion WHERE tipo='ACCESS_REVOKED';",'2');
  // Rejected payment and future pending subscription cannot generate success notifications.
  const base=snapshot();
  sql(`INSERT INTO public.pago(monto,id_metodo_pago,id_estado,id_usuario) VALUES(29,1,2,10),(0,1,1,10);
    INSERT INTO public.suscripcion(fecha_inicio,fecha_fin,id_usuario,id_plan,id_estado) VALUES(CURRENT_DATE+1,CURRENT_DATE+30,10,1,1);`);
  assert.equal(snapshot(),base);checks++;
  sql('UPDATE public.suscripcion SET fecha_inicio=CURRENT_DATE,id_estado=2 WHERE id=2;');
  equal("SELECT count(*) FROM public.notificacion WHERE tipo='SUBSCRIPTION_ACTIVATED';",'2');
  // Observer failure is isolated: primary payment commits; its claim is rolled back for retry.
  sql(`CREATE FUNCTION public.local_notif_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'PRIVATE_FAILURE'; END $$;
    CREATE TRIGGER local_notif_failure BEFORE INSERT ON public.notificacion FOR EACH ROW EXECUTE FUNCTION public.local_notif_failure();
    INSERT INTO public.pago(monto,id_metodo_pago,id_estado,id_usuario,referencia) VALUES(29,1,1,10,'PRIMARY_OK');`);
  equal("SELECT count(*) FROM public.pago WHERE referencia='PRIMARY_OK';",'1');
  equal("SELECT count(*) FROM public.cloudbox_notification_event WHERE tipo='PAYMENT_APPROVED' AND clave='payment:4';",'0');
  sql('DROP TRIGGER local_notif_failure ON public.notificacion;');
  // Primary failure AFTER notification creation rolls back notification and ledger together.
  sql(`CREATE FUNCTION public.local_primary_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'PRIMARY_ROLLBACK'; END $$;
    CREATE TRIGGER zz_primary_failure AFTER INSERT ON public.pago FOR EACH ROW EXECUTE FUNCTION public.local_primary_failure();`);
  const beforeFailure=snapshot();
  denied("INSERT INTO public.pago(monto,id_metodo_pago,id_estado,id_usuario,referencia) VALUES(29,1,1,10,'ROLLED_BACK');",/PRIMARY_ROLLBACK/);
  assert.equal(snapshot(),beforeFailure);checks++;
  equal("SELECT count(*) FROM public.pago WHERE referencia='ROLLED_BACK';",'0');sql('DROP TRIGGER zz_primary_failure ON public.pago;');
  // Real concurrent sessions: one idempotency claim, one visible notification.
  const first=session('BEGIN; SET ROLE service_role; '+emit('concurrent')+" SELECT 'HELD'; SELECT pg_sleep(1); COMMIT;");
  await Promise.race([first.ready,timeout()]);const second=session('SET ROLE service_role; '+emit('concurrent'));
  const [a,b]=await Promise.all([first.done,second.done]);assert.equal(a.code,0,a.err);assert.equal(b.code,0,b.err);checks++;
  equal("SELECT count(*) FROM public.cloudbox_notification_event WHERE clave='concurrent';",'1');
  const deleteId=sql("SELECT max(id) FROM public.notificacion WHERE tipo='FILE_SHARED';");
  sql(`DELETE FROM public.notificacion WHERE id=${deleteId};`);equal(emit('concurrent'),'');
  const nonces=snapshot();
  const x=session('BEGIN; UPDATE public.compartir SET id_estado=1 WHERE id=1; SELECT \'HELD\'; SELECT pg_sleep(1); COMMIT;');
  await Promise.race([x.ready,timeout()]);const y=session('UPDATE public.compartir SET id_estado=1 WHERE id=1;');
  const [c,d]=await Promise.all([x.done,y.done]);assert.equal(c.code,0,c.err);assert.equal(d.code,0,d.err);checks++;
  assert.notEqual(snapshot(),nonces);
  equal("SELECT count(*) FROM public.notificacion WHERE tipo='FILE_SHARED';",'3');
  // The revoked grant belongs to OLD recipient/resource, even if a privileged edit also replaces fields.
  sql(`INSERT INTO public.compartir(id_archivo,id_usuario_emisor,id_usuario_receptor,id_permiso,id_estado) VALUES(1,20,10,2,1);
    UPDATE public.compartir SET id_estado=2,id_usuario_receptor=20,id_archivo=NULL,id_carpeta=1 WHERE id=3;`);
  equal("SELECT (id_usuario=10 AND tipo_recurso='archivo' AND id_recurso=1)::text FROM public.notificacion WHERE tipo='ACCESS_REVOKED' ORDER BY id DESC LIMIT 1;",'true');
  equal('SELECT count(*) FROM public.notificacion WHERE id_usuario=20;','1');
  equal("SET ROLE service_role; SELECT count(*) FROM public.actividad a JOIN public.accion x ON x.id=a.id_accion WHERE id_usuario=10 AND fecha>='2026-10-25T00:00:00Z' AND fecha<'2026-10-26T00:00:00Z' AND x.nombre='Subir archivo';",'2');
  sql(`INSERT INTO public.compartir(id_archivo,id_usuario_emisor,id_usuario_receptor,id_permiso,id_estado) VALUES(1,20,10,2,1);
    UPDATE public.compartir SET id_estado=2,id_usuario_receptor=20,id_archivo=NULL,id_carpeta=NULL WHERE id=4;`);
  equal("SELECT (id_usuario=10 AND tipo_recurso='archivo' AND id_recurso=1)::text FROM public.notificacion WHERE tipo='ACCESS_REVOKED' ORDER BY id DESC LIMIT 1;",'true');
  const beforeRollback=snapshot();sql(read('supabase/manual/notifications/20261027_etapa3_rollback.sql'));
  assert.equal(snapshot(),beforeRollback);checks++;
  sql('UPDATE public.compartir SET id_estado=2 WHERE id=1;');assert.equal(snapshot(),beforeRollback);checks++;
  sql(patch);assert.equal(snapshot(),beforeRollback);checks++;
  // Real Free insert trigger remains unchanged and its successful insert reaches activation.
  sql(`INSERT INTO auth.users VALUES('00000000-0000-0000-0000-000000000030');
    INSERT INTO public.usuario(id,nombre,apellido,correo,id_rol,id_estado,auth_user_id) OVERRIDING SYSTEM VALUE
    VALUES(30,'Nueva','Prueba','tres@local.invalid',1,1,'00000000-0000-0000-0000-000000000030');`);
  equal("SELECT count(*) FROM public.notificacion WHERE id_usuario=30 AND tipo='SUBSCRIPTION_ACTIVATED';",'1');
  equal("SELECT md5(prosrc) FROM pg_proc WHERE oid='public.cloudbox_assign_free_after_user_insert()'::regprocedure;",freeHash);
  console.log(`PASS stage3 PostgreSQL: ${checks} checks; seven producers, legacy read state, RLS/ACL, failure isolation, rollback, concurrency and persistent dedup. No stage2 SQL executed.`);
 }finally{
   sql(`DROP DATABASE IF EXISTS ${emptyDb} WITH (FORCE);`,'postgres');
   sql(`DROP DATABASE IF EXISTS ${db} WITH (FORCE);`,'postgres');
 }
})().catch(error=>{console.error(error.stderr||error);process.exitCode=1;});
