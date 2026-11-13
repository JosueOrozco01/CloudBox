'use strict';
// Exclusively a disposable PostgreSQL Docker container, with no network or .env.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync,spawn}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),container='cloudbox-commercial-stage2',db='commercial_'+Date.now();
const docker=args=>execFileSync('docker',args,{encoding:'utf8'});
const info=JSON.parse(docker(['inspect',container]))[0];
assert.equal(info.Config.Image,'postgres:17');assert.equal(info.Config.Labels?.['cloudbox.task'],'commercial-stage2');
assert.equal(info.HostConfig.NetworkMode,'none');assert.ok(!info.HostConfig.Binds?.length);
assert.ok(info.Mounts.every(m=>m.Type==='volume'&&/^[a-f0-9]{64}$/.test(m.Name)&&m.Destination==='/var/lib/postgresql/data'));
const args=['exec','-i',container,'psql','-X','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1','-Atq'];
const sql=(input,database=db)=>execFileSync('docker',[...args.slice(0,8),database,...args.slice(9)],{input,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const patch=read('supabase/manual/commercial/20261027_etapa2.sql');
let checks=0;
function equal(input,expected){assert.equal(sql(input),expected);checks++;}
function denied(input,pattern){assert.throws(()=>sql(input),e=>pattern.test(String(e.stderr)));checks++;}
function call(name,user,plan,ref,fail=false){
  return `SET ROLE service_role; SELECT public.${name}(${user},${plan},1,'${ref}',${fail});`;
}
function session(input){
  const child=spawn('docker',args);let out='',err='';
  let signal;const ready=new Promise(resolve=>signal=resolve);
  const done=new Promise((resolve,reject)=>{
    child.stdout.on('data',v=>{out+=v;if(out.includes('HELD'))signal();});
    child.stderr.on('data',v=>err+=v);child.on('error',reject);child.on('close',code=>resolve({code,out,err}));
  });child.stdin.end(input);return {ready,done};
}
const sleepTimeout=()=>new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('SQL lock readiness timeout')),15000);timer.unref();});
(async()=>{
  try {
    sql(`CREATE DATABASE ${db};`,'postgres');
    // Reconstruct ONLY the isolated, exported baseline. These are not pending remote migrations.
    sql(read('backend/tests/sql/subscription-schema.sql'));
    for(const file of ['20261024000000_payment_engine.sql','20261024020000_free_subscription.sql','20261025010000_subscription_checkout_atomic.sql','20261025020000_subscription_lifecycle.sql','20261025030000_subscription_policy_v2.sql','20261025050000_renombrar_tablas_suscripcion.sql'])sql(read('supabase/migrations/'+file));
    sql(`GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
      GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
      ALTER TABLE public.plan ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.suscripcion ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.usuario ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.pago ENABLE ROW LEVEL SECURITY;`);
    // Verified production behavior: missing Free warns instead of aborting signup.
    sql(`CREATE OR REPLACE FUNCTION public.cloudbox_assign_free_after_user_insert() RETURNS trigger
      LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $real$
      DECLARE v_free_id integer; BEGIN
      SELECT id INTO v_free_id FROM public.plan WHERE lower(btrim(nombre))='free' AND precio=0 AND espacio_maximo_gb=1 AND id_estado=1 ORDER BY id LIMIT 1;
      IF v_free_id IS NULL THEN RAISE WARNING 'CloudBox: plan Free no disponible para usuario %',NEW.id; RETURN NEW; END IF;
      IF NOT EXISTS(SELECT 1 FROM public.suscripcion WHERE id_usuario=NEW.id) THEN
        INSERT INTO public.suscripcion(id_usuario,id_plan,id_estado,fecha_inicio,fecha_fin)
        VALUES(NEW.id,v_free_id,2,CURRENT_DATE,CURRENT_DATE+36500) ON CONFLICT DO NOTHING;
      END IF; RETURN NEW; END; $real$;`);
    const freeHash=sql("SELECT md5(prosrc) FROM pg_proc WHERE oid='public.cloudbox_assign_free_after_user_insert()'::regprocedure;");
    const rows=sql('SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM public.suscripcion s;');
    denied(`BEGIN; UPDATE public.plan SET precio=1 WHERE id=8; ${patch}`,/Falta Free real/);
    denied(`BEGIN; CREATE OR REPLACE FUNCTION public.cloudbox_subscription_cancel_v1(p_user_id integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN RETURN '{}'::jsonb; END $$; ${patch}`,/Deriva RPC/);
    sql(patch);sql(patch);
    const inspected=JSON.parse(sql(read('supabase/manual/commercial/20261027_inspeccion.sql')));
    assert.ok(inspected.functions.some(f=>f.signature==='cloudbox_assign_free_after_user_insert()'));checks++;
    equal('SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM public.suscripcion s;',rows);
    equal("SELECT md5(prosrc) FROM pg_proc WHERE oid='public.cloudbox_assign_free_after_user_insert()'::regprocedure;",freeHash);
    for(const role of ['anon','authenticated'])denied(`SET ROLE ${role}; SELECT public.cloudbox_subscription_expire_v1();`,/permission denied/);
    denied(call('cloudbox_subscribe_paid_v1',101,2,'BYPASSUPGRADE'),/CLOUDBOX_CHANGE_PLAN_REQUIRED/);
    denied(call('cloudbox_subscribe_paid_v1',101,1,'BYPASSSAME01'),/CLOUDBOX_SAME_PLAN_REQUIRES_RENEWAL/);
    equal("SELECT count(*) FROM public.pago WHERE referencia LIKE 'BYPASS%';",'0');
    for(const update of ["precio=1","espacio_maximo_gb=2","nombre='Otro'","id_estado=2"])denied(`UPDATE public.plan SET ${update} WHERE id=8;`,/FREE_PLAN_PROTECTED/);
    denied('DELETE FROM public.plan WHERE id=8;',/FREE_PLAN_PROTECTED/);
    for(const update of ['precio=100','vigencia_dias=60','espacio_maximo_gb=9'])denied(`UPDATE public.plan SET ${update} WHERE id=1;`,/PLAN_TERMS_IMMUTABLE/);
    const upgrade=JSON.parse(sql(call('cloudbox_subscription_change_v1',101,2,'UPGRADEHIST01')));
    assert.equal(upgrade.creditGenerated,4.5);assert.equal(upgrade.amountDue,20.5);checks+=2;
    denied(call('cloudbox_subscribe_paid_v1',101,1,'BYPASSDOWN01'),/CHANGE_PLAN_REQUIRED/);
    const downgrade=JSON.parse(sql(call('cloudbox_subscription_change_v1',101,1,'DOWNGRADE001')));
    assert.equal(downgrade.scheduled,true);checks++;
    equal(`SELECT (sc.fecha_efectiva=s.fecha_fin+1 AND f.fecha_inicio=s.fecha_fin+1 AND f.fecha_fin=s.fecha_fin+30)::text
      FROM public.programacion_suscripcion sc JOIN public.suscripcion s ON s.id=sc.id_suscripcion_origen JOIN public.suscripcion f ON f.id=sc.id_suscripcion_futura WHERE sc.id_usuario=101;`,'true');
    denied(call('cloudbox_subscribe_paid_v1',101,3,'PENDINGBUY01'),/PENDING_ACTION_EXISTS/);
    denied("SELECT public.cloudbox_subscription_renew_v1(101,1,'PENDINGRENEW',false);",/PENDING_ACTION_EXISTS/);
    // A delayed prepaid activation still honors the future subscription's final civil day.
    const paymentsBeforeWorker=sql('SELECT count(*) FROM public.pago;');
    sql(`UPDATE public.suscripcion SET fecha_fin=CURRENT_DATE-1 WHERE id=${downgrade.previousSubscriptionId};
      UPDATE public.suscripcion SET fecha_inicio=CURRENT_DATE,fecha_fin=CURRENT_DATE WHERE id=${downgrade.subscriptionId};
      UPDATE public.programacion_suscripcion SET fecha_efectiva=CURRENT_DATE WHERE id_usuario=101;
      SELECT public.cloudbox_subscription_expire_v1();`);
    equal(`SELECT (id_estado IN(2,3))::text FROM public.suscripcion WHERE id=${downgrade.subscriptionId};`,'true');
    equal('SELECT count(*) FROM public.pago;',paymentsBeforeWorker);
    // Restore a pending operation for the renewal-conflict checks below.
    sql('SELECT public.cloudbox_subscription_cancel_v1(101);');
    // Declined transactions preserve subscription and credit, while recording a declined payment.
    const before=sql('SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM public.suscripcion s WHERE id_usuario=102;');
    assert.equal(JSON.parse(sql(call('cloudbox_subscription_change_v1',102,2,'DECLINED0001',true))).success,false);checks++;
    equal('SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM public.suscripcion s WHERE id_usuario=102;',before);
    // A transaction failure after business writes must restore everything, including the ledger.
    sql(`CREATE FUNCTION public.local_payment_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.referencia='FORCEDFAIL01' THEN RAISE EXCEPTION 'LOCAL_PAYMENT_FAILURE'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER local_payment_failure BEFORE INSERT ON public.pago FOR EACH ROW EXECUTE FUNCTION public.local_payment_failure();`);
    const ledgerSnapshot=()=>sql(`SELECT jsonb_build_object('payments',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.pago p WHERE id_usuario=102),
      'credit',(SELECT to_jsonb(c) FROM public.credito_suscripcion c WHERE id_usuario=102),
      'events',(SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM public.evento_credito_suscripcion e WHERE id_usuario=102));`);
    const ledgerBefore=ledgerSnapshot();
    denied(call('cloudbox_subscription_change_v1',102,2,'FORCEDFAIL01'),/LOCAL_PAYMENT_FAILURE/);
    equal('SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM public.suscripcion s WHERE id_usuario=102;',before);
    equal("SELECT count(*) FROM public.evento_credito_suscripcion WHERE referencia='FORCEDFAIL01';",'0');
    assert.equal(ledgerSnapshot(),ledgerBefore);checks++;
    sql('INSERT INTO public.credito_suscripcion(id_usuario,saldo) VALUES(103,200);');
    const zero=JSON.parse(sql(call('cloudbox_subscription_change_v1',103,2,'CREDITZERO01')));
    assert.equal(zero.amountDue,0);assert.equal(zero.remainingCredit,179.5);checks+=2;
    equal("SELECT count(*) FROM public.pago WHERE referencia='CREDITZERO01';",'0');
    denied("SELECT public.cloudbox_subscription_renew_v1(103,1,'CREDITZERO01',false);",/Referencia duplicada/);
    denied("SELECT public.cloudbox_subscription_renew_v1(101,1,'PENDINGFAIL01',true);",/PENDING_ACTION_EXISTS/);
    // Existing final dates are untouched. Old schedules at fecha_fin wait until the next day.
    sql('UPDATE public.suscripcion SET fecha_fin=CURRENT_DATE WHERE id_usuario=104 AND id_estado IN(2,3);');
    sql('SELECT public.cloudbox_subscription_cancel_v1(104);');
    equal('SELECT (fecha_efectiva=CURRENT_DATE+1)::text FROM public.programacion_suscripcion WHERE id_usuario=104;','true');
    sql("UPDATE public.programacion_suscripcion SET fecha_efectiva=CURRENT_DATE WHERE id_usuario=104; SELECT public.cloudbox_subscription_expire_v1();");
    equal("SELECT estado FROM public.programacion_suscripcion WHERE id_usuario=104;",'pending');
    sql('UPDATE public.suscripcion SET fecha_fin=CURRENT_DATE-1 WHERE id_usuario=104 AND id_estado IN(2,3);');
    const workers=await Promise.all([session('SELECT public.cloudbox_subscription_expire_v1();').done,session('SELECT public.cloudbox_subscription_expire_v1();').done]);
    assert.ok(workers.every(r=>r.code===0),JSON.stringify(workers));checks++;
    equal('SELECT count(*) FROM public.suscripcion WHERE id_usuario=104 AND id_estado IN(2,3);','1');
    equal("SELECT estado FROM public.programacion_suscripcion WHERE id_usuario=104;",'applied');
    // First purchase is exactly N civil days; renewal adds N without losing the existing end date.
    const purchase=JSON.parse(sql(call('cloudbox_subscribe_paid_v1',110,1,'NEWBUY00001')));
    equal(`SELECT (fecha_fin-fecha_inicio+1)::text FROM public.suscripcion WHERE id=${purchase.subscriptionId};`,'30');
    const end=sql(`SELECT fecha_fin FROM public.suscripcion WHERE id=${purchase.subscriptionId};`);
    const renewed=JSON.parse(sql("SELECT public.cloudbox_subscription_renew_v1(110,1,'RENEW000001',false);"));
    equal(`SELECT (fecha_fin='${end}'::date+30)::text FROM public.suscripcion WHERE id=${renewed.subscriptionId};`,'true');
    sql('UPDATE public.suscripcion SET fecha_fin=CURRENT_DATE-1 WHERE id_usuario=107 AND id_estado IN(2,3);');
    const expiredPurchase=JSON.parse(sql(call('cloudbox_subscribe_paid_v1',107,1,'EXPIREDNEW01')));
    equal(`SELECT id_estado::text FROM public.suscripcion WHERE id=${expiredPurchase.previousSubscriptionId};`,'4');
    // Serialize concurrent changes on the same user: one upgrade, one commercial conflict.
    const first=session('BEGIN; '+call('cloudbox_subscription_change_v1',105,2,'RACECHANGE01')+" SELECT 'HELD'; SELECT pg_sleep(1); COMMIT;");
    await Promise.race([first.ready,sleepTimeout()]);
    const second=session(call('cloudbox_subscription_change_v1',105,2,'RACECHANGE02'));
    const [a,b]=await Promise.all([first.done,second.done]);assert.equal(a.code,0,a.err);assert.notEqual(b.code,0);assert.match(b.err,/SAME_PLAN_REQUIRES_RENEWAL/);checks++;
    equal('SELECT count(*) FROM public.suscripcion WHERE id_usuario=105 AND id_estado IN(2,3);','1');
    equal("SELECT count(*) FROM public.evento_credito_suscripcion WHERE referencia LIKE 'RACECHANGE%';",'1');
    // Catalog edits racing a first purchase cannot reprice the acquired contract.
    sql("INSERT INTO public.plan(id,nombre,precio,espacio_maximo_gb,vigencia_dias,id_estado) OVERRIDING SYSTEM VALUE VALUES(50,'Nueva tarifa',20,2,30,1);");
    const buyer=session('BEGIN; '+call('cloudbox_subscribe_paid_v1',111,50,'RACEBUY0001')+" SELECT 'HELD'; SELECT pg_sleep(1); COMMIT;");
    await Promise.race([buyer.ready,sleepTimeout()]);
    const editor=session('UPDATE public.plan SET precio=99 WHERE id=50;');
    const [c,d]=await Promise.all([buyer.done,editor.done]);assert.equal(c.code,0,c.err);assert.notEqual(d.code,0);assert.match(d.err,/PLAN_TERMS_IMMUTABLE/);checks++;
    equal('SELECT precio::text FROM public.plan WHERE id=50;','20');
    // Inverse race: an edit committed before acquisition is the new contract, not a stale charge.
    sql("INSERT INTO public.plan(id,nombre,precio,espacio_maximo_gb,vigencia_dias,id_estado) OVERRIDING SYSTEM VALUE VALUES(51,'Otra tarifa',20,2,30,1);");
    const changing=session("BEGIN; UPDATE public.plan SET precio=25 WHERE id=51; SELECT 'HELD'; SELECT pg_sleep(1); COMMIT;");
    await Promise.race([changing.ready,sleepTimeout()]);
    const buying=session(call('cloudbox_subscribe_paid_v1',112,51,'RACEBUY0002'));
    const [e,f]=await Promise.all([changing.done,buying.done]);assert.equal(e.code,0,e.err);assert.equal(f.code,0,f.err);checks++;
    equal("SELECT monto::text FROM public.pago WHERE referencia='RACEBUY0002';",'25');
    // Two different users racing one reference: unique constraint rolls back the losing purchase.
    sql(`INSERT INTO auth.users SELECT md5('local-extra-'||i)::uuid FROM generate_series(113,114) i;
      INSERT INTO public.usuario(id,nombre,apellido,correo,id_rol,id_estado,auth_user_id) OVERRIDING SYSTEM VALUE
      SELECT i,'Prueba','Local','extra-'||i||'@example.invalid',1,1,md5('local-extra-'||i)::uuid FROM generate_series(113,114) i;`);
    const uniqueFirst=session('BEGIN; '+call('cloudbox_subscribe_paid_v1',113,1,'CROSSUSER001')+" SELECT 'HELD'; SELECT pg_sleep(1); COMMIT;");
    await Promise.race([uniqueFirst.ready,sleepTimeout()]);
    const uniqueSecond=session(call('cloudbox_subscribe_paid_v1',114,1,'CROSSUSER001'));
    const [g,h]=await Promise.all([uniqueFirst.done,uniqueSecond.done]);assert.equal(g.code,0,g.err);assert.notEqual(h.code,0);checks++;
    equal("SELECT count(*) FROM public.pago WHERE referencia='CROSSUSER001';",'1');
    equal('SELECT id_plan::text FROM public.suscripcion WHERE id_usuario=114 AND id_estado IN(2,3);','8');
    // Revert only definitions, preserving the new business records and the real Free trigger.
    const allRows=()=>sql(`SELECT jsonb_build_object('subs',(SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM public.suscripcion s),
      'payments',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.pago p),
      'events',(SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM public.evento_credito_suscripcion e));`);
    const dataBeforeRollback=allRows();
    sql(read('supabase/manual/commercial/20261027_etapa2_rollback.sql'));
    assert.equal(allRows(),dataBeforeRollback);checks++;
    equal("SELECT md5(prosrc) FROM pg_proc WHERE oid='public.cloudbox_assign_free_after_user_insert()'::regprocedure;",freeHash);
    sql(patch);assert.equal(allRows(),dataBeforeRollback);checks++;
    console.log(`PASS stage2 SQL: ${checks} checks; real renamed baseline, dates, Free preserved, historical terms, transactions, concurrent workers/changes/catalog edits.`);
  } finally { sql(`DROP DATABASE IF EXISTS ${db} WITH (FORCE);`,'postgres'); }
})().catch(error=>{console.error(error.stderr||error);process.exitCode=1;});
