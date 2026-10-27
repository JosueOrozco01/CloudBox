-- CloudBox Fase 7: políticas comerciales v2 (revisión de concurrencia; version final candidata; probar antes de aplicar permanentemente).
-- No alterar migraciones anteriores. Este SQL reemplaza funciones v1 preservando sus firmas.
-- Requiere plan Free, índices únicos y funciones de la entrega 04.
BEGIN;
CREATE TABLE IF NOT EXISTS public.cloudbox_subscription_credit (
  id_usuario integer PRIMARY KEY REFERENCES public.usuario(id),
  saldo numeric(12,2) NOT NULL DEFAULT 0 CHECK (saldo >= 0),
  fecha_actualizacion timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.cloudbox_subscription_schedule (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_usuario integer NOT NULL REFERENCES public.usuario(id),
  id_suscripcion_origen integer NOT NULL REFERENCES public.suscripcion(id),
  id_suscripcion_futura integer REFERENCES public.suscripcion(id),
  id_pago integer REFERENCES public.pago(id),
  tipo text NOT NULL CHECK (tipo IN ('cancel','downgrade')),
  id_plan_destino integer NOT NULL REFERENCES public.plan(id),
  fecha_efectiva date NOT NULL,
  estado text NOT NULL DEFAULT 'pending' CHECK (estado IN ('pending','applied','superseded','error')),
  fecha_creacion timestamptz NOT NULL DEFAULT now(),
  fecha_aplicacion timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS cloudbox_schedule_one_pending_per_user
 ON public.cloudbox_subscription_schedule(id_usuario) WHERE estado='pending';
CREATE INDEX IF NOT EXISTS cloudbox_schedule_due_idx
 ON public.cloudbox_subscription_schedule(fecha_efectiva,id) WHERE estado='pending';
CREATE TABLE IF NOT EXISTS public.cloudbox_subscription_credit_event (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_usuario integer NOT NULL REFERENCES public.usuario(id),
  id_suscripcion_anterior integer REFERENCES public.suscripcion(id),
  id_suscripcion_nueva integer REFERENCES public.suscripcion(id),
  monto_generado numeric(12,2) NOT NULL DEFAULT 0,
  monto_aplicado numeric(12,2) NOT NULL DEFAULT 0,
  saldo_resultante numeric(12,2) NOT NULL DEFAULT 0,
  fecha timestamptz NOT NULL DEFAULT now(),
  referencia text
);
CREATE UNIQUE INDEX IF NOT EXISTS cloudbox_credit_reference_unique
 ON public.cloudbox_subscription_credit_event(referencia) WHERE referencia IS NOT NULL;
-- Only internal service_role may read audit/commercial scheduling data; no client direct access.
REVOKE ALL ON public.cloudbox_subscription_credit,
 public.cloudbox_subscription_schedule, public.cloudbox_subscription_credit_event FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE ON public.cloudbox_subscription_credit,
 public.cloudbox_subscription_schedule, public.cloudbox_subscription_credit_event TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.cloudbox_subscription_schedule_id_seq,
 public.cloudbox_subscription_credit_event_id_seq TO service_role;

-- Upgrade: aplicar saldo prepagado; si el saldo excede el precio, se arrastra al próximo pago.
-- Downgrade: se paga HOY una única cuota del nuevo plan, creando suscripción Pendiente,
-- que se activará al vencimiento del plan anterior (sin débito automático de tarjeta).
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
    EXISTS(SELECT 1 FROM public.cloudbox_subscription_credit_event WHERE referencia=p_reference) THEN
   RAISE unique_violation USING MESSAGE='Referencia duplicada';
 END IF;
 IF EXISTS(SELECT 1 FROM public.cloudbox_subscription_schedule WHERE id_usuario=p_user_id AND estado='pending') THEN
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
   INSERT INTO public.cloudbox_subscription_schedule
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
 INSERT INTO public.cloudbox_subscription_credit(id_usuario,saldo) VALUES(p_user_id,0)
   ON CONFLICT(id_usuario) DO NOTHING;
 SELECT saldo INTO v_existing_credit FROM public.cloudbox_subscription_credit WHERE id_usuario=p_user_id FOR UPDATE;
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
 UPDATE public.cloudbox_subscription_credit SET saldo=v_credit_left,fecha_actualizacion=now() WHERE id_usuario=p_user_id;
 INSERT INTO public.cloudbox_subscription_credit_event
    (id_usuario,id_suscripcion_anterior,id_suscripcion_nueva,monto_generado,monto_aplicado,saldo_resultante,referencia)
    VALUES(p_user_id,v_old.id,v_newsub,v_unused,v_credit_used,v_credit_left,p_reference);
 RETURN pg_catalog.jsonb_build_object('success',true,'scheduled',false,'planId',p_plan_id,'planName',v_new_plan.nombre,
   'subscriptionId',v_newsub,'previousSubscriptionId',v_old.id,'status','Activa',
   'creditGenerated',v_unused,'creditApplied',v_credit_used,'remainingCredit',v_credit_left,
   'amountDue',v_due,'endDate',CURRENT_DATE+v_new_plan.vigencia_dias,
   'payment',CASE WHEN v_payment IS NULL THEN NULL ELSE pg_catalog.jsonb_build_object('paymentId',v_payment,'amount',v_due,'status','Aprobado') END);
END;
$function$;

-- Cancelar pago no utilizado al final: no crear Free todavía.
CREATE OR REPLACE FUNCTION public.cloudbox_subscription_cancel_v1(p_user_id integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE v_old public.suscripcion%ROWTYPE; v_free integer; v_schedule bigint;
BEGIN
 PERFORM 1 FROM public.usuario WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CLOUDBOX_USER_NOT_FOUND'; END IF;
 IF EXISTS(SELECT 1 FROM public.cloudbox_subscription_schedule WHERE id_usuario=p_user_id AND estado='pending')
 THEN RAISE EXCEPTION 'CLOUDBOX_PENDING_ACTION_EXISTS'; END IF;
 SELECT * INTO v_old FROM public.suscripcion WHERE id_usuario=p_user_id AND id_estado IN (2,3)
   AND fecha_fin >= CURRENT_DATE ORDER BY id DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CLOUDBOX_NO_ACTIVE_SUBSCRIPTION'; END IF;
 SELECT id INTO v_free FROM public.plan WHERE lower(btrim(nombre))='free' AND precio=0 AND espacio_maximo_gb=1
  AND id_estado=1 ORDER BY id LIMIT 1;
 IF v_free IS NULL THEN RAISE EXCEPTION 'CLOUDBOX_PLAN_UNAVAILABLE'; END IF;
 IF v_old.id_plan=v_free THEN RAISE EXCEPTION 'CLOUDBOX_FREE_RENEWAL_NOT_REQUIRED'; END IF;
 INSERT INTO public.cloudbox_subscription_schedule(id_usuario,id_suscripcion_origen,tipo,id_plan_destino,fecha_efectiva)
   VALUES(p_user_id,v_old.id,'cancel',v_free,v_old.fecha_fin) RETURNING id INTO v_schedule;
 RETURN pg_catalog.jsonb_build_object('success',true,'scheduled',true,'status','Programada',
 'scheduleId',v_schedule,'previousSubscriptionId',v_old.id,'subscriptionId',v_old.id,
 'effectiveOn',v_old.fecha_fin,'planId',v_free,'planName','Free','payment',NULL);
END;
$function$;

-- La renovación de una cuenta que ya programó una acción queda bloqueada hasta gestionar esa acción.
-- No se reemplaza el cuerpo v1: se usa un trigger SELECT-safe para impedir renuevos que salten fecha pactada.
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
     SELECT 1 FROM public.cloudbox_subscription_schedule sc
     WHERE sc.id_usuario = OLD.id_usuario
       AND sc.id_suscripcion_origen = OLD.id AND sc.estado = 'pending'
   ) THEN
   RAISE EXCEPTION 'CLOUDBOX_PENDING_ACTION_EXISTS';
 END IF;
 RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS cloudbox_prevent_renew_with_schedule ON public.suscripcion;
CREATE TRIGGER cloudbox_prevent_renew_with_schedule BEFORE UPDATE OF id_estado ON public.suscripcion
FOR EACH ROW EXECUTE FUNCTION public.cloudbox_subscription_prevent_renew_with_schedule();

-- Trabajador transaccional invocado desde servicio autorizado. Sin cron automático en esta entrega.
-- También crea Free al finalizar una suscripción que no programó acción.
CREATE OR REPLACE FUNCTION public.cloudbox_subscription_expire_v1()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_candidate record;
  v_schedule public.cloudbox_subscription_schedule%ROWTYPE;
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
    SELECT id, id_usuario FROM public.cloudbox_subscription_schedule
    WHERE estado = 'pending' AND fecha_efectiva <= CURRENT_DATE
    ORDER BY id
  LOOP
    PERFORM 1 FROM public.usuario WHERE id = v_candidate.id_usuario FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;
    SELECT * INTO v_schedule FROM public.cloudbox_subscription_schedule
      WHERE id = v_candidate.id AND id_usuario = v_candidate.id_usuario
        AND estado = 'pending' AND fecha_efectiva <= CURRENT_DATE
      FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;
    SELECT * INTO v_current FROM public.suscripcion
      WHERE id = v_schedule.id_suscripcion_origen AND id_usuario = v_schedule.id_usuario
      FOR UPDATE;
    IF NOT FOUND OR v_current.id_estado NOT IN (v_active, v_expiring) THEN
      UPDATE public.cloudbox_subscription_schedule
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
    UPDATE public.cloudbox_subscription_schedule
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
      SELECT 1 FROM public.cloudbox_subscription_schedule
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

REVOKE ALL ON FUNCTION public.cloudbox_subscription_change_v1(integer,integer,integer,text,boolean),
 public.cloudbox_subscription_cancel_v1(integer),public.cloudbox_subscription_expire_v1() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cloudbox_subscription_change_v1(integer,integer,integer,text,boolean),
 public.cloudbox_subscription_cancel_v1(integer),public.cloudbox_subscription_expire_v1() TO service_role;
COMMIT;
