-- Fase 7: normalizacion incremental de nombres. Sin cambios de reglas de negocio.
-- Requiere las definiciones revisadas de 20261025030000; aborta ante conflictos o deriva.
-- No ejecutar sobre produccion desde herramientas de desarrollo. Ver docs/RENOMBRADO_TABLAS_FASE7.md.
BEGIN;
SET LOCAL lock_timeout = '10s';
DO $preflight$
DECLARE item record; actual text;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('cloudbox_subscription_credit', 'credito_suscripcion'),
    ('cloudbox_subscription_credit_event', 'evento_credito_suscripcion'),
    ('cloudbox_subscription_schedule', 'programacion_suscripcion')
  ) AS names(source_name,target_name) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=item.source_name AND c.relkind IN ('r','p')) THEN
      RAISE EXCEPTION 'Falta tabla origen: %', item.source_name;
    END IF;
    IF to_regclass('public.' || item.target_name) IS NOT NULL THEN
      RAISE EXCEPTION 'Conflicto: ya existe destino %', item.target_name;
    END IF;
  END LOOP;
  -- Impide sobrescribir funciones que difieran de la version revisada.
  -- Se normalizan CRLF, sin modificar SQL ni comentarios.
  FOR item IN SELECT * FROM (VALUES
      ('public.cloudbox_subscription_change_v1(integer,integer,integer,text,boolean)', '86db7c7b51e9821a58cc48341ca8b2a4'),
      ('public.cloudbox_subscription_cancel_v1(integer)', '3f129b9d9788367c9e01cc49d358b1a2'),
      ('public.cloudbox_subscription_prevent_renew_with_schedule()', 'bcb28578f950360bae1921ac7b60b6fa'),
      ('public.cloudbox_subscription_expire_v1()', 'a4141c6d8ed8d33f4f84b80deda1f9a3')
  ) AS definitions(signature,expected_md5) LOOP
    SELECT md5(replace(p.prosrc,E'\r\n',E'\n')) INTO actual
    FROM pg_proc p WHERE p.oid=to_regprocedure(item.signature);
    IF actual IS DISTINCT FROM item.expected_md5 THEN
      RAISE EXCEPTION 'Funcion ausente o distinta de version revisada: %',item.signature;
    END IF;
  END LOOP;
  -- Buscar TODAS las funciones, no asumir que solo existen las cuatro del repositorio.
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname NOT IN ('pg_catalog','information_schema')
      AND p.prosrc ~ 'cloudbox_subscription_credit|cloudbox_subscription_credit_event|cloudbox_subscription_schedule'
      AND p.oid NOT IN (to_regprocedure('public.cloudbox_subscription_change_v1(integer,integer,integer,text,boolean)'),
        to_regprocedure('public.cloudbox_subscription_cancel_v1(integer)'),
        to_regprocedure('public.cloudbox_subscription_prevent_renew_with_schedule()'),
        to_regprocedure('public.cloudbox_subscription_expire_v1()'))) THEN
    RAISE EXCEPTION 'Hay funciones adicionales con nombres anteriores; revisar dependencias antes de continuar';
  END IF;
END;
$preflight$;

-- ALTER conserva OID, filas, PK/FK, indices, secuencias, ACL, RLS y politicas.
-- Sus nombres internos se conservan para no romper dependencias externas.
ALTER TABLE public.cloudbox_subscription_credit RENAME TO credito_suscripcion;
ALTER TABLE public.cloudbox_subscription_credit_event RENAME TO evento_credito_suscripcion;
ALTER TABLE public.cloudbox_subscription_schedule RENAME TO programacion_suscripcion;

CREATE OR REPLACE FUNCTION public.cloudbox_subscription_change_v1(
 p_user_id integer,p_plan_id integer,p_method_id integer,p_reference text,p_simulate_failure boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
 v_old public.suscripcion%ROWTYPE; v_old_plan public.plan%ROWTYPE; v_new_plan public.plan%ROWTYPE;
 v_free integer; v_active integer; v_pending integer; v_canceled integer; v_approved integer; v_rejected integer;
 v_due numeric(12,2); v_existing_credit numeric(12,2); v_unused numeric(12,2); v_total numeric(12,2);
 v_credit_used numeric(12,2); v_credit_left numeric(12,2);
 v_newsub integer; v_payment integer; v_schedule bigint; v_transaction text; v_days integer;
BEGIN
 PERFORM 1 FROM public.usuario WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CLOUDBOX_USER_NOT_FOUND'; END IF;
 IF p_reference IS NULL OR p_reference !~ '^[A-Za-z0-9][A-Za-z0-9_-]{7,99}$' THEN RAISE EXCEPTION 'CLOUDBOX_INVALID_REFERENCE'; END IF;
 IF EXISTS(SELECT 1 FROM public.pago WHERE referencia=p_reference) OR
    EXISTS(SELECT 1 FROM public.evento_credito_suscripcion WHERE referencia=p_reference) THEN
   RAISE unique_violation USING MESSAGE='Referencia duplicada';
 END IF;
 IF EXISTS(SELECT 1 FROM public.programacion_suscripcion WHERE id_usuario=p_user_id AND estado='pending') THEN
   RAISE EXCEPTION 'CLOUDBOX_PENDING_ACTION_EXISTS';
 END IF;
 SELECT * INTO v_old FROM public.suscripcion WHERE id_usuario=p_user_id
  AND id_estado IN (2,3) AND fecha_fin >= CURRENT_DATE ORDER BY id DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CLOUDBOX_NO_ACTIVE_SUBSCRIPTION'; END IF;
 SELECT * INTO v_old_plan FROM public.plan WHERE id=v_old.id_plan;
 SELECT * INTO v_new_plan FROM public.plan WHERE id=p_plan_id;
 IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.estado_plan WHERE id=v_new_plan.id_estado AND lower(nombre)='activo')
 THEN RAISE EXCEPTION 'CLOUDBOX_PLAN_UNAVAILABLE'; END IF;
 IF v_new_plan.precio <= 0 THEN RAISE EXCEPTION 'CLOUDBOX_INVALID_PLAN_DOWNGRADE'; END IF;
 IF v_old.id_plan=p_plan_id THEN RAISE EXCEPTION 'CLOUDBOX_SAME_PLAN_REQUIRES_RENEWAL'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.metodo_pago WHERE id=p_method_id AND estado IS TRUE)
 THEN RAISE EXCEPTION 'CLOUDBOX_PAYMENT_METHOD_INVALID'; END IF;
 SELECT id INTO v_active FROM public.estado_suscripcion WHERE nombre='Activa';
 SELECT id INTO v_pending FROM public.estado_suscripcion WHERE nombre='Pendiente';
 SELECT id INTO v_canceled FROM public.estado_suscripcion WHERE nombre='Cancelada';
 SELECT id INTO v_approved FROM public.estado_pago WHERE nombre='Aprobado';
 SELECT id INTO v_rejected FROM public.estado_pago WHERE nombre='Rechazado';
 IF v_active IS NULL OR v_pending IS NULL OR v_canceled IS NULL OR v_approved IS NULL OR v_rejected IS NULL
 THEN RAISE EXCEPTION 'CLOUDBOX_STATE_NOT_FOUND'; END IF;
 v_transaction:='TRX-CHANGE-'||replace(pg_catalog.gen_random_uuid()::text,'-','');
 IF v_new_plan.precio < v_old_plan.precio THEN
   -- Cobro simulado al programar; en el futuro NO se cobra por segunda vez.
   IF COALESCE(p_simulate_failure,false) THEN
     INSERT INTO public.pago(id_usuario,id_suscripcion,id_metodo_pago,monto,referencia,transaccion_id,id_estado)
       VALUES(p_user_id,NULL,p_method_id,v_new_plan.precio,p_reference,v_transaction,v_rejected) RETURNING id INTO v_payment;
     RETURN pg_catalog.jsonb_build_object('success',false,'code','PAYMENT_DECLINED','paymentId',v_payment,'status','Rechazado');
   END IF;
   INSERT INTO public.suscripcion(fecha_inicio,fecha_fin,id_usuario,id_plan,id_estado)
     VALUES(v_old.fecha_fin,v_old.fecha_fin+v_new_plan.vigencia_dias,p_user_id,p_plan_id,v_pending)
     RETURNING id INTO v_newsub;
   INSERT INTO public.pago(id_usuario,id_suscripcion,id_metodo_pago,monto,referencia,transaccion_id,id_estado)
     VALUES(p_user_id,v_newsub,p_method_id,v_new_plan.precio,p_reference,v_transaction,v_approved)
     RETURNING id INTO v_payment;
   INSERT INTO public.programacion_suscripcion
     (id_usuario,id_suscripcion_origen,id_suscripcion_futura,id_pago,tipo,id_plan_destino,fecha_efectiva)
     VALUES(p_user_id,v_old.id,v_newsub,v_payment,'downgrade',p_plan_id,v_old.fecha_fin)
     RETURNING id INTO v_schedule;
   RETURN pg_catalog.jsonb_build_object('success',true,'scheduled',true,'scheduleId',v_schedule,
      'subscriptionId',v_newsub,'previousSubscriptionId',v_old.id,'status','Pendiente',
      'planId',p_plan_id,'planName',v_new_plan.nombre,'effectiveOn',v_old.fecha_fin,
      'payment',pg_catalog.jsonb_build_object('paymentId',v_payment,'amount',v_new_plan.precio,'status','Aprobado'));
 END IF;
 IF v_new_plan.precio = v_old_plan.precio THEN
   RAISE EXCEPTION 'CLOUDBOX_SAME_PRICE_CHANGE_NOT_SUPPORTED';
 END IF;
 -- Los días acumulados por renovaciones también generan crédito; día actual sin fracción.
 v_days:=GREATEST(0,v_old.fecha_fin-CURRENT_DATE);
 v_unused:=ROUND(v_old_plan.precio * v_days / GREATEST(1,v_old_plan.vigencia_dias),2);
 INSERT INTO public.credito_suscripcion(id_usuario,saldo) VALUES(p_user_id,0)
   ON CONFLICT(id_usuario) DO NOTHING;
 SELECT saldo INTO v_existing_credit FROM public.credito_suscripcion WHERE id_usuario=p_user_id FOR UPDATE;
 v_total:=v_unused+v_existing_credit;
 v_credit_used:=LEAST(v_total,v_new_plan.precio);
 v_due:=ROUND(v_new_plan.precio-v_credit_used,2);
 v_credit_left:=ROUND(v_total-v_credit_used,2);
 IF COALESCE(p_simulate_failure,false) AND v_due>0 THEN
   INSERT INTO public.pago(id_usuario,id_suscripcion,id_metodo_pago,monto,referencia,transaccion_id,id_estado)
     VALUES(p_user_id,NULL,p_method_id,v_due,p_reference,v_transaction,v_rejected) RETURNING id INTO v_payment;
   RETURN pg_catalog.jsonb_build_object('success',false,'code','PAYMENT_DECLINED','paymentId',v_payment,'status','Rechazado');
 END IF;
 UPDATE public.suscripcion SET id_estado=v_canceled WHERE id=v_old.id;
 INSERT INTO public.suscripcion(fecha_inicio,fecha_fin,id_usuario,id_plan,id_estado)
   VALUES(CURRENT_DATE,CURRENT_DATE+v_new_plan.vigencia_dias,p_user_id,p_plan_id,v_active)
   RETURNING id INTO v_newsub;
 IF v_due>0 THEN
   INSERT INTO public.pago(id_usuario,id_suscripcion,id_metodo_pago,monto,referencia,transaccion_id,id_estado)
     VALUES(p_user_id,v_newsub,p_method_id,v_due,p_reference,v_transaction,v_approved) RETURNING id INTO v_payment;
 END IF;
 UPDATE public.credito_suscripcion SET saldo=v_credit_left,fecha_actualizacion=now() WHERE id_usuario=p_user_id;
 INSERT INTO public.evento_credito_suscripcion
    (id_usuario,id_suscripcion_anterior,id_suscripcion_nueva,monto_generado,monto_aplicado,saldo_resultante,referencia)
    VALUES(p_user_id,v_old.id,v_newsub,v_unused,v_credit_used,v_credit_left,p_reference);
 RETURN pg_catalog.jsonb_build_object('success',true,'scheduled',false,'planId',p_plan_id,'planName',v_new_plan.nombre,
   'subscriptionId',v_newsub,'previousSubscriptionId',v_old.id,'status','Activa',
   'creditGenerated',v_unused,'creditApplied',v_credit_used,'remainingCredit',v_credit_left,
   'amountDue',v_due,'endDate',CURRENT_DATE+v_new_plan.vigencia_dias,
   'payment',CASE WHEN v_payment IS NULL THEN NULL ELSE pg_catalog.jsonb_build_object('paymentId',v_payment,'amount',v_due,'status','Aprobado') END);
END;
$function$;

CREATE OR REPLACE FUNCTION public.cloudbox_subscription_cancel_v1(p_user_id integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE v_old public.suscripcion%ROWTYPE; v_free integer; v_schedule bigint;
BEGIN
 PERFORM 1 FROM public.usuario WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CLOUDBOX_USER_NOT_FOUND'; END IF;
 IF EXISTS(SELECT 1 FROM public.programacion_suscripcion WHERE id_usuario=p_user_id AND estado='pending')
 THEN RAISE EXCEPTION 'CLOUDBOX_PENDING_ACTION_EXISTS'; END IF;
 SELECT * INTO v_old FROM public.suscripcion WHERE id_usuario=p_user_id AND id_estado IN (2,3)
   AND fecha_fin >= CURRENT_DATE ORDER BY id DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CLOUDBOX_NO_ACTIVE_SUBSCRIPTION'; END IF;
 SELECT id INTO v_free FROM public.plan WHERE lower(btrim(nombre))='free' AND precio=0 AND espacio_maximo_gb=1
  AND id_estado=1 ORDER BY id LIMIT 1;
 IF v_free IS NULL THEN RAISE EXCEPTION 'CLOUDBOX_PLAN_UNAVAILABLE'; END IF;
 IF v_old.id_plan=v_free THEN RAISE EXCEPTION 'CLOUDBOX_FREE_RENEWAL_NOT_REQUIRED'; END IF;
 INSERT INTO public.programacion_suscripcion(id_usuario,id_suscripcion_origen,tipo,id_plan_destino,fecha_efectiva)
   VALUES(p_user_id,v_old.id,'cancel',v_free,v_old.fecha_fin) RETURNING id INTO v_schedule;
 RETURN pg_catalog.jsonb_build_object('success',true,'scheduled',true,'status','Programada',
 'scheduleId',v_schedule,'previousSubscriptionId',v_old.id,'subscriptionId',v_old.id,
 'effectiveOn',v_old.fecha_fin,'planId',v_free,'planName','Free','payment',NULL);
END;
$function$;

CREATE OR REPLACE FUNCTION public.cloudbox_subscription_prevent_renew_with_schedule()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $function$
BEGIN
 -- Impide saltarse cancelaciones/downgrades mediante /subscribe o /renew.
 -- Solo protege la suscripcion de origen; una programacion aplicada ya no bloquea.
 IF NEW.id_estado IS DISTINCT FROM OLD.id_estado
   AND NEW.id_estado IN (
     SELECT es.id FROM public.estado_suscripcion es
     WHERE es.nombre IN ('Cancelada', 'Renovada')
   )
   AND EXISTS (
     SELECT 1 FROM public.programacion_suscripcion sc
     WHERE sc.id_usuario = OLD.id_usuario
       AND sc.id_suscripcion_origen = OLD.id AND sc.estado = 'pending'
   ) THEN
   RAISE EXCEPTION 'CLOUDBOX_PENDING_ACTION_EXISTS';
 END IF;
 RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cloudbox_subscription_expire_v1()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_candidate record;
  v_schedule public.programacion_suscripcion%ROWTYPE;
  v_current public.suscripcion%ROWTYPE;
  v_future public.suscripcion%ROWTYPE;
  v_free integer;
  v_active integer;
  v_expiring integer;
  v_expired integer;
  v_canceled integer;
  v_pending integer;
  v_applied integer := 0;
  v_to_free integer := 0;
  v_near integer := 0;
  v_expired_count integer := 0;
BEGIN
  SELECT id INTO v_active FROM public.estado_suscripcion WHERE nombre = 'Activa';
  SELECT id INTO v_expiring FROM public.estado_suscripcion WHERE nombre = 'PorVencer';
  SELECT id INTO v_expired FROM public.estado_suscripcion WHERE nombre = 'Vencida';
  SELECT id INTO v_canceled FROM public.estado_suscripcion WHERE nombre = 'Cancelada';
  SELECT id INTO v_pending FROM public.estado_suscripcion WHERE nombre = 'Pendiente';
  SELECT p.id INTO v_free FROM public.plan p
   JOIN public.estado_plan ep ON ep.id = p.id_estado
   WHERE lower(btrim(p.nombre)) = 'free' AND p.precio = 0
     AND p.espacio_maximo_gb = 1 AND lower(ep.nombre) = 'activo'
   ORDER BY p.id LIMIT 1;
  IF v_active IS NULL OR v_expiring IS NULL OR v_expired IS NULL
     OR v_canceled IS NULL OR v_pending IS NULL OR v_free IS NULL THEN
    RAISE EXCEPTION 'CLOUDBOX_STATE_NOT_FOUND';
  END IF;

  -- Procesar las operaciones programadas respetando el orden de bloqueo:
  -- usuario -> programacion -> suscripcion. No bloquear schedule en el cursor.
  FOR v_candidate IN
    SELECT id, id_usuario FROM public.programacion_suscripcion
    WHERE estado = 'pending' AND fecha_efectiva <= CURRENT_DATE
    ORDER BY id
  LOOP
    PERFORM 1 FROM public.usuario WHERE id = v_candidate.id_usuario FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;
    SELECT * INTO v_schedule FROM public.programacion_suscripcion
      WHERE id = v_candidate.id AND id_usuario = v_candidate.id_usuario
        AND estado = 'pending' AND fecha_efectiva <= CURRENT_DATE
      FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;
    SELECT * INTO v_current FROM public.suscripcion
      WHERE id = v_schedule.id_suscripcion_origen AND id_usuario = v_schedule.id_usuario
      FOR UPDATE;
    IF NOT FOUND OR v_current.id_estado NOT IN (v_active, v_expiring) THEN
      UPDATE public.programacion_suscripcion
        SET estado = 'superseded', fecha_aplicacion = now()
        WHERE id = v_schedule.id;
      CONTINUE;
    END IF;
    IF v_current.fecha_fin > CURRENT_DATE THEN
      -- Ante datos inconsistentes, no cortar tiempo pagado antes de fecha.
      RAISE EXCEPTION 'CLOUDBOX_SCHEDULE_BEFORE_SUBSCRIPTION_END';
    END IF;
    IF v_schedule.tipo = 'downgrade' THEN
      SELECT * INTO v_future FROM public.suscripcion
        WHERE id = v_schedule.id_suscripcion_futura
          AND id_usuario = v_schedule.id_usuario FOR UPDATE;
      IF NOT FOUND OR v_future.id_estado <> v_pending
         OR v_future.id_plan <> v_schedule.id_plan_destino THEN
        RAISE EXCEPTION 'CLOUDBOX_SCHEDULED_PLAN_MISSING';
      END IF;
    END IF;

    -- Se marca applied en la misma transaccion ANTES de cancelar la suscripcion.
    -- El trigger de proteccion bloquea checkout externo mientras este pending;
    -- si esta transaccion falla, PostgreSQL revierte ambas acciones.
    UPDATE public.programacion_suscripcion
      SET estado = 'applied', fecha_aplicacion = now() WHERE id = v_schedule.id;
    UPDATE public.suscripcion SET id_estado = v_canceled WHERE id = v_current.id;
    IF v_schedule.tipo = 'cancel' THEN
      INSERT INTO public.suscripcion(fecha_inicio, fecha_fin, id_usuario, id_plan, id_estado)
      VALUES (CURRENT_DATE, CURRENT_DATE + 36500, v_schedule.id_usuario, v_free, v_active);
      v_to_free := v_to_free + 1;
    ELSIF v_schedule.tipo = 'downgrade' THEN
      IF v_future.fecha_fin <= CURRENT_DATE THEN
        -- Ejecucion tardia: el periodo prepago ya terminó. No activar un plan vencido.
        UPDATE public.suscripcion SET id_estado = v_expired WHERE id = v_future.id;
        INSERT INTO public.suscripcion(fecha_inicio, fecha_fin, id_usuario, id_plan, id_estado)
          VALUES (CURRENT_DATE, CURRENT_DATE + 36500, v_schedule.id_usuario, v_free, v_active);
        v_to_free := v_to_free + 1;
      ELSE
        UPDATE public.suscripcion SET id_estado = v_active WHERE id = v_future.id;
      END IF;
    ELSE
      RAISE EXCEPTION 'CLOUDBOX_UNKNOWN_SCHEDULE_TYPE';
    END IF;
    v_applied := v_applied + 1;
  END LOOP;

  -- Vencimientos sin operacion pendiente. Revalidar luego de bloquear usuario.
  FOR v_candidate IN
    SELECT s.id, s.id_usuario FROM public.suscripcion s
    JOIN public.plan p ON p.id = s.id_plan
    WHERE s.id_estado IN (v_active, v_expiring) AND s.fecha_fin < CURRENT_DATE
      AND p.precio > 0 ORDER BY s.id
  LOOP
    PERFORM 1 FROM public.usuario WHERE id = v_candidate.id_usuario FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;
    SELECT * INTO v_current FROM public.suscripcion
      WHERE id = v_candidate.id AND id_usuario = v_candidate.id_usuario FOR UPDATE;
    IF NOT FOUND OR v_current.id_estado NOT IN (v_active, v_expiring)
       OR v_current.fecha_fin >= CURRENT_DATE THEN CONTINUE; END IF;
    IF EXISTS (
      SELECT 1 FROM public.programacion_suscripcion
      WHERE id_usuario = v_current.id_usuario AND estado = 'pending'
    ) THEN
      -- Una operacion programada debe procesarse primero; no crear Free duplicado.
      CONTINUE;
    END IF;
    UPDATE public.suscripcion SET id_estado = v_expired WHERE id = v_current.id;
    INSERT INTO public.suscripcion(fecha_inicio, fecha_fin, id_usuario, id_plan, id_estado)
      VALUES (CURRENT_DATE, CURRENT_DATE + 36500, v_current.id_usuario, v_free, v_active);
    v_expired_count := v_expired_count + 1;
  END LOOP;

  -- Igualmente bloquear primero usuario y luego suscripcion para cambios a PorVencer.
  FOR v_candidate IN
    SELECT s.id, s.id_usuario FROM public.suscripcion s
      JOIN public.plan p ON p.id = s.id_plan
    WHERE s.id_estado = v_active AND p.precio > 0
      AND s.fecha_fin BETWEEN CURRENT_DATE AND CURRENT_DATE + 5
    ORDER BY s.id
  LOOP
    PERFORM 1 FROM public.usuario WHERE id = v_candidate.id_usuario FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;
    SELECT * INTO v_current FROM public.suscripcion
      WHERE id = v_candidate.id AND id_usuario = v_candidate.id_usuario FOR UPDATE;
    IF NOT FOUND OR v_current.id_estado <> v_active
       OR v_current.fecha_fin NOT BETWEEN CURRENT_DATE AND CURRENT_DATE + 5 THEN CONTINUE; END IF;
    UPDATE public.suscripcion SET id_estado = v_expiring WHERE id = v_current.id;
    v_near := v_near + 1;
  END LOOP;

  RETURN pg_catalog.jsonb_build_object('success', true,
    'scheduledApplied', v_applied, 'freeActivated', v_to_free,
    'expiredToFree', v_expired_count, 'expiring', v_near);
END;
$function$;

DO $verify$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND p.prosrc ~ 'cloudbox_subscription_credit|cloudbox_subscription_credit_event|cloudbox_subscription_schedule') THEN
    RAISE EXCEPTION 'Persisten referencias de funciones a nombres anteriores';
  END IF;
END;
$verify$;
COMMIT;
