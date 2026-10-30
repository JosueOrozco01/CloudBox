-- REVISION MANUAL: estado real exportado tras renombrado y permisos de etapa 1.
-- NO ejecutado en Supabase. No reinstala migraciones ni la funcion real Free.
-- No modifica datos existentes, fechas contratadas ni programaciones previas.
BEGIN;
SET LOCAL lock_timeout='10s';
DO $preflight$
DECLARE actual text;
BEGIN
 IF to_regclass('public.credito_suscripcion') IS NULL OR to_regclass('public.programacion_suscripcion') IS NULL OR to_regclass('public.evento_credito_suscripcion') IS NULL THEN RAISE EXCEPTION 'Falta esquema real renombrado'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.plan WHERE lower(btrim(nombre))='free' AND precio=0 AND espacio_maximo_gb=1 AND id_estado=1) THEN RAISE EXCEPTION 'Falta Free real Q0/1 GB/activo: revisar sin crear ni corregir datos a ciegas'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.estado_plan WHERE id=1 AND lower(btrim(nombre))='activo') OR EXISTS(
   SELECT 1 FROM public.plan WHERE (lower(btrim(nombre))='free' AND (precio<>0 OR espacio_maximo_gb<>1 OR id_estado<>1))
     OR (precio=0 AND lower(btrim(nombre))<>'free')) THEN RAISE EXCEPTION 'Catalogo Free inconsistente; requiere revision de datos por el operador'; END IF;
 IF to_regprocedure('public.cloudbox_assign_free_after_user_insert()') IS NULL THEN RAISE EXCEPTION 'Falta funcion Free instalada'; END IF;
  SELECT md5(replace(prosrc,E'\r\n',E'\n')) INTO actual FROM pg_proc WHERE oid=to_regprocedure('public.cloudbox_subscribe_paid_v1(integer,integer,integer,text,boolean)');
  IF actual IS NULL OR actual NOT IN ('8811c3785afdbc611dd7167ad3e92637','686b21f91eb6664ecdc3d07fddfba628') THEN RAISE EXCEPTION 'Deriva RPC: public.cloudbox_subscribe_paid_v1(integer,integer,integer,text,boolean)'; END IF;
  SELECT md5(replace(prosrc,E'\r\n',E'\n')) INTO actual FROM pg_proc WHERE oid=to_regprocedure('public.cloudbox_subscription_renew_v1(integer,integer,text,boolean)');
  IF actual IS NULL OR actual NOT IN ('f54ad5f7f2034eb1ddb0b018363e43b4','3f418c0b9410ffeb522d9969703504f8') THEN RAISE EXCEPTION 'Deriva RPC: public.cloudbox_subscription_renew_v1(integer,integer,text,boolean)'; END IF;
  SELECT md5(replace(prosrc,E'\r\n',E'\n')) INTO actual FROM pg_proc WHERE oid=to_regprocedure('public.cloudbox_subscription_change_v1(integer,integer,integer,text,boolean)');
  IF actual IS NULL OR actual NOT IN ('5395d000756fa96445c8a5d5e075f746','5d9e4641caf9ac028818e8f39a5a0080') THEN RAISE EXCEPTION 'Deriva RPC: public.cloudbox_subscription_change_v1(integer,integer,integer,text,boolean)'; END IF;
  SELECT md5(replace(prosrc,E'\r\n',E'\n')) INTO actual FROM pg_proc WHERE oid=to_regprocedure('public.cloudbox_subscription_cancel_v1(integer)');
  IF actual IS NULL OR actual NOT IN ('65975fdb7378311eddf13c7f9e985c7d','0134b78fb2122f623dcb2858d980475a') THEN RAISE EXCEPTION 'Deriva RPC: public.cloudbox_subscription_cancel_v1(integer)'; END IF;
  SELECT md5(replace(prosrc,E'\r\n',E'\n')) INTO actual FROM pg_proc WHERE oid=to_regprocedure('public.cloudbox_subscription_expire_v1()');
  IF actual IS NULL OR actual NOT IN ('487add72bf7164e60d217d6f4d596bf0','672e3984f8e4ab381c00857808493b57') THEN RAISE EXCEPTION 'Deriva RPC: public.cloudbox_subscription_expire_v1()'; END IF;

 IF to_regprocedure('public.cloudbox_stage2_guard_plan()') IS NOT NULL AND (SELECT md5(replace(prosrc,E'\r\n',E'\n')) FROM pg_proc WHERE oid=to_regprocedure('public.cloudbox_stage2_guard_plan()')) IS DISTINCT FROM '908605332a8145e717c63a1bfac68d22' THEN RAISE EXCEPTION 'Conflicto con funcion cloudbox_stage2_guard_plan'; END IF;
 IF to_regprocedure('public.cloudbox_stage2_lock_plan()') IS NOT NULL AND (SELECT md5(replace(prosrc,E'\r\n',E'\n')) FROM pg_proc WHERE oid=to_regprocedure('public.cloudbox_stage2_lock_plan()')) IS DISTINCT FROM '0fd42c34344b763a2e354f48ed873514' THEN RAISE EXCEPTION 'Conflicto con funcion cloudbox_stage2_lock_plan'; END IF;

 IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.plan'::regclass AND tgname='cloudbox_stage2_guard_plan'
   AND tgfoid IS DISTINCT FROM to_regprocedure('public.cloudbox_stage2_guard_plan()'))
 OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.suscripcion'::regclass AND tgname='cloudbox_stage2_lock_plan'
   AND tgfoid IS DISTINCT FROM to_regprocedure('public.cloudbox_stage2_lock_plan()')) THEN
   RAISE EXCEPTION 'Conflicto con triggers de etapa 2'; END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.cloudbox_stage2_guard_plan() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $function$
BEGIN
 IF TG_OP='DELETE' THEN
   IF lower(btrim(OLD.nombre))='free' THEN RAISE EXCEPTION 'CLOUDBOX_FREE_PLAN_PROTECTED'; END IF;
   RETURN OLD;
 END IF;
 IF lower(btrim(NEW.nombre))='free' THEN
   IF NEW.precio<>0 OR NEW.espacio_maximo_gb<>1 OR NEW.id_estado<>1 THEN RAISE EXCEPTION 'CLOUDBOX_FREE_PLAN_PROTECTED'; END IF;
 ELSIF NEW.precio=0 THEN RAISE EXCEPTION 'CLOUDBOX_FREE_PLAN_PROTECTED'; END IF;
 IF TG_OP='UPDATE' THEN
   IF lower(btrim(OLD.nombre))='free' AND lower(btrim(NEW.nombre))<>'free' THEN RAISE EXCEPTION 'CLOUDBOX_FREE_PLAN_PROTECTED'; END IF;
   IF (NEW.precio,NEW.espacio_maximo_gb,NEW.vigencia_dias) IS DISTINCT FROM (OLD.precio,OLD.espacio_maximo_gb,OLD.vigencia_dias)
     AND EXISTS(SELECT 1 FROM public.suscripcion WHERE id_plan=OLD.id) THEN RAISE EXCEPTION 'CLOUDBOX_PLAN_TERMS_IMMUTABLE'; END IF;
 END IF;
 RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.cloudbox_stage2_lock_plan() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $function$
BEGIN
 PERFORM 1 FROM public.plan WHERE id=NEW.id_plan FOR SHARE;
 RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS cloudbox_stage2_guard_plan ON public.plan;
CREATE TRIGGER cloudbox_stage2_guard_plan BEFORE INSERT OR UPDATE OR DELETE ON public.plan FOR EACH ROW EXECUTE FUNCTION public.cloudbox_stage2_guard_plan();
DROP TRIGGER IF EXISTS cloudbox_stage2_lock_plan ON public.suscripcion;
CREATE TRIGGER cloudbox_stage2_lock_plan BEFORE INSERT OR UPDATE OF id_plan ON public.suscripcion FOR EACH ROW EXECUTE FUNCTION public.cloudbox_stage2_lock_plan();
REVOKE ALL ON FUNCTION public.cloudbox_stage2_guard_plan(),public.cloudbox_stage2_lock_plan() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.cloudbox_subscribe_paid_v1(p_user_id integer, p_plan_id integer, p_method_id integer, p_reference text, p_simulate_failure boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_plan public.plan%ROWTYPE;
  v_active_state integer;
  v_expiring_state integer;
  v_canceled_state integer;
  v_approved_state integer;
  v_rejected_state integer;
  v_previous_id integer;
  v_previous_plan_id integer;
  v_subscription_id integer;
  v_payment_id integer;
  v_transaction text;
  v_amount numeric;
BEGIN
  -- Serializar todas las contrataciones simultaneas de este usuario.
  PERFORM 1 FROM public.usuario WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CLOUDBOX_USER_NOT_FOUND'; END IF;

  IF p_reference IS NULL OR p_reference !~ '^[A-Za-z0-9][A-Za-z0-9_-]{7,99}$' THEN
    RAISE EXCEPTION 'CLOUDBOX_MISSING_PAYMENT_REFERENCE';
  END IF;

  IF EXISTS(SELECT 1 FROM public.programacion_suscripcion WHERE id_usuario=p_user_id AND estado='pending') THEN
    RAISE EXCEPTION 'CLOUDBOX_PENDING_ACTION_EXISTS';
  END IF;
  SELECT * INTO v_plan FROM public.plan WHERE id = p_plan_id FOR SHARE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.estado_plan ep
    WHERE ep.id = v_plan.id_estado AND lower(ep.nombre) = 'activo'
  ) THEN RAISE EXCEPTION 'CLOUDBOX_PLAN_UNAVAILABLE'; END IF;
  IF v_plan.precio <= 0 THEN RAISE EXCEPTION 'CLOUDBOX_FREE_NOT_PAYABLE'; END IF;

  PERFORM 1 FROM public.metodo_pago
  WHERE id = p_method_id AND estado IS TRUE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CLOUDBOX_PAYMENT_METHOD_INVALID'; END IF;

  SELECT id INTO v_active_state FROM public.estado_suscripcion WHERE nombre = 'Activa';
  SELECT id INTO v_expiring_state FROM public.estado_suscripcion WHERE nombre = 'PorVencer';
  SELECT id INTO v_canceled_state FROM public.estado_suscripcion WHERE nombre = 'Cancelada';
  IF v_active_state IS NULL OR v_expiring_state IS NULL OR v_canceled_state IS NULL THEN
    RAISE EXCEPTION 'CLOUDBOX_SUBSCRIPTION_STATE_MISSING';
  END IF;

  SELECT id INTO v_approved_state FROM public.estado_pago WHERE nombre = 'Aprobado';
  SELECT id INTO v_rejected_state FROM public.estado_pago WHERE nombre = 'Rechazado';
  IF v_approved_state IS NULL OR v_rejected_state IS NULL THEN
    RAISE EXCEPTION 'CLOUDBOX_PAYMENT_STATE_MISSING';
  END IF;

  -- Evitar renovaciones involuntarias mediante /subscribe.
  SELECT s.id, s.id_plan
    INTO v_previous_id, v_previous_plan_id
  FROM public.suscripcion s
  WHERE s.id_usuario = p_user_id
    AND s.id_estado IN (v_active_state, v_expiring_state)
  ORDER BY s.id DESC LIMIT 1 FOR UPDATE;

  IF EXISTS(SELECT 1 FROM public.suscripcion s JOIN public.plan p ON p.id=s.id_plan
    WHERE s.id=v_previous_id AND s.fecha_fin>=CURRENT_DATE AND p.precio>0) THEN
    IF v_previous_plan_id=v_plan.id THEN RAISE EXCEPTION 'CLOUDBOX_SAME_PLAN_REQUIRES_RENEWAL'; END IF;
    RAISE EXCEPTION 'CLOUDBOX_CHANGE_PLAN_REQUIRED';
  END IF;

  -- Ademas del indice unico, comprobar la referencia antes de escribir.
  IF EXISTS (SELECT 1 FROM public.pago WHERE referencia = p_reference) OR EXISTS(SELECT 1 FROM public.evento_credito_suscripcion WHERE referencia=p_reference) THEN
    RAISE unique_violation USING MESSAGE = 'Referencia duplicada';
  END IF;

  v_transaction := 'TRX-SUB-' || replace(pg_catalog.gen_random_uuid()::text, '-', '');
  v_amount := v_plan.precio;

  IF COALESCE(p_simulate_failure, false) THEN
    INSERT INTO public.pago
      (id_usuario, id_suscripcion, id_metodo_pago, monto, referencia, transaccion_id, id_estado)
    VALUES
      (p_user_id, NULL, p_method_id, v_amount, p_reference, v_transaction, v_rejected_state)
    RETURNING id INTO v_payment_id;

    RETURN pg_catalog.jsonb_build_object(
      'success', false, 'paymentId', v_payment_id, 'status', 'Rechazado',
      'code', 'PAYMENT_DECLINED', 'referenceCode', p_reference
    );
  END IF;

  -- El UPDATE, INSERT de suscripcion e INSERT de pago son atomicos.
  UPDATE public.suscripcion
  SET id_estado = CASE WHEN fecha_fin<CURRENT_DATE THEN (SELECT id FROM public.estado_suscripcion WHERE nombre='Vencida') ELSE v_canceled_state END
  WHERE id_usuario = p_user_id
    AND id_estado IN (v_active_state, v_expiring_state);

  INSERT INTO public.suscripcion
    (fecha_inicio, fecha_fin, id_usuario, id_plan, id_estado)
  VALUES
    (CURRENT_DATE, CURRENT_DATE + v_plan.vigencia_dias - 1,
     p_user_id, p_plan_id, v_active_state)
  RETURNING id INTO v_subscription_id;

  INSERT INTO public.pago
    (id_usuario, id_suscripcion, id_metodo_pago, monto, referencia, transaccion_id, id_estado)
  VALUES
    (p_user_id, v_subscription_id, p_method_id, v_amount,
     p_reference, v_transaction, v_approved_state)
  RETURNING id INTO v_payment_id;

  RETURN pg_catalog.jsonb_build_object(
    'success', true, 'subscriptionId', v_subscription_id,
    'previousSubscriptionId', v_previous_id,
    'planId', v_plan.id, 'planName', v_plan.nombre,
    'capacityGb', v_plan.espacio_maximo_gb,
    'status', 'Activa', 'startDate', CURRENT_DATE,
    'endDate', CURRENT_DATE + v_plan.vigencia_dias - 1,
    'payment', pg_catalog.jsonb_build_object(
      'paymentId', v_payment_id, 'amount', v_amount,
      'transactionId', v_transaction, 'referenceCode', p_reference,
      'status', 'Aprobado'
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.cloudbox_subscription_renew_v1(
 p_user_id integer,p_method_id integer,p_reference text,p_simulate_failure boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET timezone = 'UTC' AS $function$
DECLARE
 v_prior public.suscripcion%ROWTYPE;
 v_plan public.plan%ROWTYPE;
 v_active integer; v_renewed integer; v_approved integer; v_rejected integer;
 v_new_sub integer; v_payment integer; v_tx text; v_start date; v_end date;
BEGIN
 PERFORM 1 FROM public.usuario WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CLOUDBOX_USER_NOT_FOUND'; END IF;
 IF EXISTS(SELECT 1 FROM public.programacion_suscripcion WHERE id_usuario=p_user_id AND estado='pending') THEN RAISE EXCEPTION 'CLOUDBOX_PENDING_ACTION_EXISTS'; END IF;
 IF p_reference IS NULL OR p_reference !~ '^[A-Za-z0-9][A-Za-z0-9_-]{7,99}$' THEN
   RAISE EXCEPTION 'CLOUDBOX_INVALID_REFERENCE';
 END IF;
 SELECT * INTO v_prior FROM public.suscripcion
 WHERE id_usuario=p_user_id AND id_estado IN (2,3) AND fecha_inicio<=CURRENT_DATE AND fecha_fin >= CURRENT_DATE
 ORDER BY id DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CLOUDBOX_NO_ACTIVE_SUBSCRIPTION'; END IF;
 SELECT * INTO v_plan FROM public.plan WHERE id=v_prior.id_plan FOR SHARE;
 IF NOT FOUND OR v_plan.precio <= 0 THEN RAISE EXCEPTION 'CLOUDBOX_FREE_RENEWAL_NOT_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.metodo_pago WHERE id=p_method_id AND estado IS TRUE) THEN
   RAISE EXCEPTION 'CLOUDBOX_PAYMENT_METHOD_INVALID';
 END IF;
 IF EXISTS(SELECT 1 FROM public.pago WHERE referencia=p_reference) OR EXISTS(SELECT 1 FROM public.evento_credito_suscripcion WHERE referencia=p_reference) THEN
   RAISE unique_violation USING MESSAGE='Referencia duplicada';
 END IF;
 SELECT id INTO v_active FROM public.estado_suscripcion WHERE nombre='Activa';
 SELECT id INTO v_renewed FROM public.estado_suscripcion WHERE nombre='Renovada';
 SELECT id INTO v_approved FROM public.estado_pago WHERE nombre='Aprobado';
 SELECT id INTO v_rejected FROM public.estado_pago WHERE nombre='Rechazado';
 IF v_active IS NULL OR v_renewed IS NULL OR v_approved IS NULL OR v_rejected IS NULL THEN
   RAISE EXCEPTION 'CLOUDBOX_STATE_NOT_FOUND';
 END IF;
 v_tx:='TRX-REN-'||replace(pg_catalog.gen_random_uuid()::text,'-','');
 IF COALESCE(p_simulate_failure,false) THEN
   INSERT INTO public.pago(id_usuario,id_suscripcion,id_metodo_pago,monto,referencia,transaccion_id,id_estado)
   VALUES(p_user_id,NULL,p_method_id,v_plan.precio,p_reference,v_tx,v_rejected) RETURNING id INTO v_payment;
   RETURN pg_catalog.jsonb_build_object('success',false,'code','PAYMENT_DECLINED','status','Rechazado',
      'paymentId',v_payment,'referenceCode',p_reference);
 END IF;
 -- Renovación acumula vigencia no consumida, preservando fecha_inicio de un nuevo período.
 v_start := CURRENT_DATE;
 v_end := GREATEST(CURRENT_DATE,v_prior.fecha_fin)+v_plan.vigencia_dias;
 UPDATE public.suscripcion SET id_estado=v_renewed WHERE id=v_prior.id;
 INSERT INTO public.suscripcion(fecha_inicio,fecha_fin,id_usuario,id_plan,id_estado)
 VALUES(v_start,v_end,p_user_id,v_plan.id,v_active) RETURNING id INTO v_new_sub;
 INSERT INTO public.pago(id_usuario,id_suscripcion,id_metodo_pago,monto,referencia,transaccion_id,id_estado)
 VALUES(p_user_id,v_new_sub,p_method_id,v_plan.precio,p_reference,v_tx,v_approved) RETURNING id INTO v_payment;
 RETURN pg_catalog.jsonb_build_object('success',true,'subscriptionId',v_new_sub,'previousSubscriptionId',v_prior.id,
   'planId',v_plan.id,'planName',v_plan.nombre,'status','Activa','startDate',v_start,'endDate',v_end,
   'payment',pg_catalog.jsonb_build_object('paymentId',v_payment,'amount',v_plan.precio,'status','Aprobado',
      'transactionId',v_tx,'referenceCode',p_reference));
END;
$function$;

CREATE OR REPLACE FUNCTION public.cloudbox_subscription_change_v1(
 p_user_id integer,p_plan_id integer,p_method_id integer,p_reference text,p_simulate_failure boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET timezone = 'UTC' AS $function$
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
  AND id_estado IN (2,3) AND fecha_inicio<=CURRENT_DATE AND fecha_fin >= CURRENT_DATE ORDER BY id DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CLOUDBOX_NO_ACTIVE_SUBSCRIPTION'; END IF;
 SELECT * INTO v_old_plan FROM public.plan WHERE id=v_old.id_plan;
 SELECT * INTO v_new_plan FROM public.plan WHERE id=p_plan_id FOR SHARE;
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
     VALUES(v_old.fecha_fin+1,v_old.fecha_fin+v_new_plan.vigencia_dias,p_user_id,p_plan_id,v_pending)
     RETURNING id INTO v_newsub;
   INSERT INTO public.pago(id_usuario,id_suscripcion,id_metodo_pago,monto,referencia,transaccion_id,id_estado)
     VALUES(p_user_id,v_newsub,p_method_id,v_new_plan.precio,p_reference,v_transaction,v_approved)
     RETURNING id INTO v_payment;
   INSERT INTO public.programacion_suscripcion
     (id_usuario,id_suscripcion_origen,id_suscripcion_futura,id_pago,tipo,id_plan_destino,fecha_efectiva)
     VALUES(p_user_id,v_old.id,v_newsub,v_payment,'downgrade',p_plan_id,v_old.fecha_fin+1)
     RETURNING id INTO v_schedule;
   RETURN pg_catalog.jsonb_build_object('success',true,'scheduled',true,'scheduleId',v_schedule,
      'subscriptionId',v_newsub,'previousSubscriptionId',v_old.id,'status','Pendiente',
      'planId',p_plan_id,'planName',v_new_plan.nombre,'effectiveOn',v_old.fecha_fin+1,
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
   VALUES(CURRENT_DATE,CURRENT_DATE+v_new_plan.vigencia_dias-1,p_user_id,p_plan_id,v_active)
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
   'amountDue',v_due,'endDate',CURRENT_DATE+v_new_plan.vigencia_dias-1,
   'payment',CASE WHEN v_payment IS NULL THEN NULL ELSE pg_catalog.jsonb_build_object('paymentId',v_payment,'amount',v_due,'status','Aprobado') END);
END;
$function$;

CREATE OR REPLACE FUNCTION public.cloudbox_subscription_cancel_v1(p_user_id integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET timezone = 'UTC' AS $function$
DECLARE v_old public.suscripcion%ROWTYPE; v_free integer; v_schedule bigint;
BEGIN
 PERFORM 1 FROM public.usuario WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CLOUDBOX_USER_NOT_FOUND'; END IF;
 IF EXISTS(SELECT 1 FROM public.programacion_suscripcion WHERE id_usuario=p_user_id AND estado='pending')
 THEN RAISE EXCEPTION 'CLOUDBOX_PENDING_ACTION_EXISTS'; END IF;
 SELECT * INTO v_old FROM public.suscripcion WHERE id_usuario=p_user_id AND id_estado IN (2,3)
   AND fecha_inicio<=CURRENT_DATE AND fecha_fin >= CURRENT_DATE ORDER BY id DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CLOUDBOX_NO_ACTIVE_SUBSCRIPTION'; END IF;
 SELECT id INTO v_free FROM public.plan WHERE lower(btrim(nombre))='free' AND precio=0 AND espacio_maximo_gb=1
  AND id_estado=1 ORDER BY id LIMIT 1;
 IF v_free IS NULL THEN RAISE EXCEPTION 'CLOUDBOX_PLAN_UNAVAILABLE'; END IF;
 IF v_old.id_plan=v_free THEN RAISE EXCEPTION 'CLOUDBOX_FREE_RENEWAL_NOT_REQUIRED'; END IF;
 INSERT INTO public.programacion_suscripcion(id_usuario,id_suscripcion_origen,tipo,id_plan_destino,fecha_efectiva)
   VALUES(p_user_id,v_old.id,'cancel',v_free,v_old.fecha_fin+1) RETURNING id INTO v_schedule;
 RETURN pg_catalog.jsonb_build_object('success',true,'scheduled',true,'status','Programada',
 'scheduleId',v_schedule,'previousSubscriptionId',v_old.id,'subscriptionId',v_old.id,
 'effectiveOn',v_old.fecha_fin+1,'planId',v_free,'planName','Free','payment',NULL);
END;
$function$;

CREATE OR REPLACE FUNCTION public.cloudbox_subscription_expire_v1()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET timezone = 'UTC' AS $function$
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
    IF v_current.fecha_fin >= CURRENT_DATE THEN
      -- Una programacion antigua puede conservar effectiveOn=fecha_fin. No cortar el ultimo dia.
      CONTINUE;
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
      IF v_future.fecha_fin < CURRENT_DATE THEN
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
REVOKE ALL ON FUNCTION public.cloudbox_subscribe_paid_v1(integer,integer,integer,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cloudbox_subscribe_paid_v1(integer,integer,integer,text,boolean) TO service_role;
REVOKE ALL ON FUNCTION public.cloudbox_subscription_renew_v1(integer,integer,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cloudbox_subscription_renew_v1(integer,integer,text,boolean) TO service_role;
REVOKE ALL ON FUNCTION public.cloudbox_subscription_change_v1(integer,integer,integer,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cloudbox_subscription_change_v1(integer,integer,integer,text,boolean) TO service_role;
REVOKE ALL ON FUNCTION public.cloudbox_subscription_cancel_v1(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cloudbox_subscription_cancel_v1(integer) TO service_role;
REVOKE ALL ON FUNCTION public.cloudbox_subscription_expire_v1() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cloudbox_subscription_expire_v1() TO service_role;
COMMIT;
