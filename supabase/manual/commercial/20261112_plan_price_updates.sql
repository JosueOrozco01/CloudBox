-- REVISION MANUAL. NO EJECUTADO EN SUPABASE.
-- Actualiza el precio de las tres filas existentes; no inserta ni elimina planes.
-- Free, suscripciones, pagos, comprobantes y créditos históricos quedan intactos.
-- Conserva el crédito proporcional de períodos vigentes usando el pago y crédito aplicados registrados.
-- Primero despliega el backend que permite actualizar solo precio; después revisa
-- y ejecuta este archivo en una ventana controlada. No es una migración automática.

BEGIN;
SET LOCAL lock_timeout = '10s';

DO $preflight$
DECLARE
  guard_source text;
  lock_source text;
  change_source text;
  change_is_definer boolean;
BEGIN
  IF to_regclass('public.plan') IS NULL OR to_regclass('public.suscripcion') IS NULL
     OR to_regclass('public.estado_plan') IS NULL OR to_regclass('public.pago') IS NULL
     OR to_regclass('public.estado_pago') IS NULL OR to_regclass('public.evento_credito_suscripcion') IS NULL THEN
    RAISE EXCEPTION 'Falta el esquema de planes esperado; no se aplicaron cambios';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.plan
    WHERE lower(btrim(nombre)) = 'free'
      AND precio = 0 AND espacio_maximo_gb = 1 AND id_estado = 1
  ) OR EXISTS (
    SELECT 1 FROM public.plan
    WHERE lower(btrim(nombre)) = 'free'
      AND (precio <> 0 OR espacio_maximo_gb <> 1 OR id_estado <> 1)
  ) THEN
    RAISE EXCEPTION 'Free no coincide con Q0, 1 GB y activo; no se aplicaron cambios';
  END IF;

  IF (SELECT count(*) FROM public.plan WHERE nombre IN ('Básico', 'Pro', 'Premium')) <> 3
     OR NOT EXISTS (SELECT 1 FROM public.plan WHERE nombre = 'Básico' AND precio = 29.00 AND espacio_maximo_gb = 5.00 AND vigencia_dias = 30)
     OR NOT EXISTS (SELECT 1 FROM public.plan WHERE nombre = 'Pro' AND precio = 89.00 AND espacio_maximo_gb = 50.00 AND vigencia_dias = 30)
     OR NOT EXISTS (SELECT 1 FROM public.plan WHERE nombre = 'Premium' AND precio = 149.00 AND espacio_maximo_gb = 100.00 AND vigencia_dias = 30) THEN
    RAISE EXCEPTION 'El catálogo no coincide con las tres filas revisadas; confirmar los datos antes de actualizar';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.suscripcion AS s
    JOIN public.plan AS p ON p.id = s.id_plan
    WHERE s.id_estado IN (2, 3) AND s.fecha_inicio <= CURRENT_DATE AND s.fecha_fin >= CURRENT_DATE
      AND p.precio > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.pago AS pg
        JOIN public.estado_pago AS ep ON ep.id = pg.id_estado
        WHERE pg.id_suscripcion = s.id AND lower(btrim(ep.nombre)) = 'aprobado'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.evento_credito_suscripcion AS e
        WHERE e.id_suscripcion_nueva = s.id AND e.monto_aplicado > 0
      )
  ) THEN
    RAISE EXCEPTION 'Hay suscripciones pagadas vigentes sin asiento de pago/crédito; revisar su valor antes de revaluar el catálogo';
  END IF;

  SELECT p.prosrc INTO guard_source
  FROM pg_catalog.pg_proc AS p
  WHERE p.oid = to_regprocedure('public.cloudbox_stage2_guard_plan()');
  SELECT p.prosrc INTO lock_source
  FROM pg_catalog.pg_proc AS p
  WHERE p.oid = to_regprocedure('public.cloudbox_stage2_lock_plan()');
  SELECT p.prosrc, p.prosecdef INTO change_source, change_is_definer
  FROM pg_catalog.pg_proc AS p
  WHERE p.oid = to_regprocedure('public.cloudbox_subscription_change_v1(integer,integer,integer,text,boolean)');

  IF guard_source IS NULL
     OR guard_source NOT LIKE '%CLOUDBOX_FREE_PLAN_PROTECTED%'
     OR guard_source NOT LIKE '%CLOUDBOX_PLAN_TERMS_IMMUTABLE%'
     OR guard_source NOT LIKE '%public.suscripcion%' THEN
    RAISE EXCEPTION 'No se reconoce el trigger guard_plan instalado; detener y revisar';
  END IF;
  IF lock_source IS NULL OR lower(lock_source) NOT LIKE '%for share%' THEN
    RAISE EXCEPTION 'No se reconoce el trigger lock_plan instalado; detener y revisar';
  END IF;
  IF change_source IS NULL
     OR change_source NOT LIKE '%CLOUDBOX_SAME_PRICE_CHANGE_NOT_SUPPORTED%'
     OR change_source NOT LIKE '%public.evento_credito_suscripcion%'
     OR change_source NOT LIKE '%v_old_plan.precio%'
     OR change_is_definer IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'No se reconoce la RPC comercial de cambios de plan; detener y revisar';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.plan'::regclass AND tgname = 'cloudbox_stage2_guard_plan'
      AND tgfoid = to_regprocedure('public.cloudbox_stage2_guard_plan()') AND NOT tgisinternal
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.suscripcion'::regclass AND tgname = 'cloudbox_stage2_lock_plan'
      AND tgfoid = to_regprocedure('public.cloudbox_stage2_lock_plan()') AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Faltan los triggers comerciales esperados; no se aplicaron cambios';
  END IF;
END;
$preflight$;

-- Mantiene los triggers instalados. Solo se permite cambiar precio en planes ya
-- contratados; Free y las condiciones contratadas conservan sus protecciones.
CREATE OR REPLACE FUNCTION public.cloudbox_stage2_guard_plan() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF lower(btrim(OLD.nombre)) = 'free' THEN
      RAISE EXCEPTION 'CLOUDBOX_FREE_PLAN_PROTECTED';
    END IF;
    RETURN OLD;
  END IF;

  IF lower(btrim(NEW.nombre)) = 'free' THEN
    IF NEW.precio <> 0 OR NEW.espacio_maximo_gb <> 1 OR NEW.id_estado <> 1 THEN
      RAISE EXCEPTION 'CLOUDBOX_FREE_PLAN_PROTECTED';
    END IF;
  ELSIF NEW.precio = 0 THEN
    RAISE EXCEPTION 'CLOUDBOX_FREE_PLAN_PROTECTED';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.nombre IS DISTINCT FROM OLD.nombre THEN
      RAISE EXCEPTION 'CLOUDBOX_PLAN_NAME_IMMUTABLE';
    END IF;
    IF lower(btrim(OLD.nombre)) = 'free'
       AND lower(btrim(NEW.nombre)) <> 'free' THEN
      RAISE EXCEPTION 'CLOUDBOX_FREE_PLAN_PROTECTED';
    END IF;
    IF (NEW.espacio_maximo_gb, NEW.vigencia_dias) IS DISTINCT FROM (OLD.espacio_maximo_gb, OLD.vigencia_dias)
       AND EXISTS (SELECT 1 FROM public.suscripcion WHERE id_plan = OLD.id) THEN
      RAISE EXCEPTION 'CLOUDBOX_PLAN_TERMS_IMMUTABLE';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Conserva la base del crédito proporcional de suscripciones en curso. Antes
-- de revaluar un plan, esta RPC usaba plan.precio; ahora usa el pago aprobado
-- más el crédito aplicado que originó esa suscripción, con fallback al precio
-- actual únicamente si no existe asiento histórico para ella.
CREATE OR REPLACE FUNCTION public.cloudbox_subscription_change_v1(
 p_user_id integer,p_plan_id integer,p_method_id integer,p_reference text,p_simulate_failure boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET timezone = 'UTC' AS $function$
DECLARE
 v_old public.suscripcion%ROWTYPE; v_old_plan public.plan%ROWTYPE; v_new_plan public.plan%ROWTYPE;
 v_free integer; v_active integer; v_pending integer; v_canceled integer; v_approved integer; v_rejected integer;
 v_due numeric(12,2); v_existing_credit numeric(12,2); v_unused numeric(12,2); v_total numeric(12,2);
 v_credit_used numeric(12,2); v_credit_left numeric(12,2); v_paid numeric(12,2);
 v_credit_applied numeric(12,2); v_old_contract_value numeric(12,2);
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
     VALUES(p_user_id,v_newsub,p_method_id,v_new_plan.precio,p_reference,v_transaction,v_approved) RETURNING id INTO v_payment;
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

 SELECT COALESCE(SUM(p.monto),0) INTO v_paid
 FROM public.pago AS p
 JOIN public.estado_pago AS ep ON ep.id=p.id_estado
 WHERE p.id_suscripcion=v_old.id AND lower(btrim(ep.nombre))='aprobado';
 SELECT COALESCE(SUM(e.monto_aplicado),0) INTO v_credit_applied
 FROM public.evento_credito_suscripcion AS e WHERE e.id_suscripcion_nueva=v_old.id;
 v_old_contract_value:=v_paid+v_credit_applied;
 IF v_old_contract_value<=0 THEN v_old_contract_value:=v_old_plan.precio; END IF;

 -- Los días acumulados por renovaciones también generan crédito; día actual sin fracción.
 v_days:=GREATEST(0,v_old.fecha_fin-CURRENT_DATE);
 v_unused:=ROUND(v_old_contract_value * v_days / GREATEST(1,v_old_plan.vigencia_dias),2);
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

-- Preflight above guarantees one row per name and the reviewed old terms.
-- The SET list changes only public.plan.precio.
UPDATE public.plan
SET precio = CASE nombre
  WHEN 'Básico' THEN 9.00
  WHEN 'Pro' THEN 25.00
  WHEN 'Premium' THEN 39.00
END
WHERE nombre IN ('Básico', 'Pro', 'Premium');

DO $postflight$
BEGIN
  IF (SELECT count(*) FROM public.plan WHERE
      (nombre = 'Básico' AND precio = 9.00 AND espacio_maximo_gb = 5.00 AND vigencia_dias = 30)
      OR (nombre = 'Pro' AND precio = 25.00 AND espacio_maximo_gb = 50.00 AND vigencia_dias = 30)
      OR (nombre = 'Premium' AND precio = 39.00 AND espacio_maximo_gb = 100.00 AND vigencia_dias = 30)) <> 3 THEN
    RAISE EXCEPTION 'La verificación del catálogo no coincide; cancelar la transacción';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.plan WHERE lower(btrim(nombre)) = 'free' AND precio = 0 AND espacio_maximo_gb = 1 AND id_estado = 1) THEN
    RAISE EXCEPTION 'Free cambió inesperadamente; cancelar la transacción';
  END IF;
END;
$postflight$;

SELECT nombre, espacio_maximo_gb, precio
FROM public.plan
WHERE nombre IN ('Free', 'Básico', 'Pro', 'Premium')
ORDER BY id;

COMMIT;
