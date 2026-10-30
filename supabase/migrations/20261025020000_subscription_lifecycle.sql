-- CloudBox Fase 7. Ejecutar SOLO en SQL Editor tras revisar y conservar copia.
-- La instalación NO cambia datos. Las funciones mutan registros cuando se invocan.
BEGIN;
DO $$ BEGIN
 IF to_regprocedure('public.cloudbox_subscribe_paid_v1(integer,integer,integer,text,boolean)') IS NULL THEN RAISE EXCEPTION 'Falta checkout v1'; END IF;
 IF to_regclass('public.suscripcion_usuario_vigente_unica_fase7') IS NULL THEN RAISE EXCEPTION 'Falta índice de suscripciones'; END IF;
 IF to_regclass('public.pago_referencia_unique_not_null') IS NULL THEN RAISE EXCEPTION 'Falta índice de pagos'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.plan WHERE lower(btrim(nombre))='free' AND precio=0 AND espacio_maximo_gb=1 AND id_estado=1) THEN RAISE EXCEPTION 'Falta Free de 1GB'; END IF;
END $$;

-- Cambiar de plan requiere una suscripción vigente; delega cobro y activación
-- a checkout v1, que ya realiza todas las escrituras atómicamente.
CREATE OR REPLACE FUNCTION public.cloudbox_subscription_change_v1(
 p_user_id integer,p_plan_id integer,p_method_id integer,p_reference text,p_simulate_failure boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE v_current integer; v_price numeric;
BEGIN
 PERFORM 1 FROM public.usuario WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CLOUDBOX_USER_NOT_FOUND'; END IF;
 SELECT id INTO v_current FROM public.suscripcion
 WHERE id_usuario=p_user_id AND id_estado IN (2,3) AND fecha_fin >= CURRENT_DATE
 ORDER BY id DESC LIMIT 1;
 IF v_current IS NULL THEN RAISE EXCEPTION 'CLOUDBOX_NO_ACTIVE_SUBSCRIPTION'; END IF;
 SELECT precio INTO v_price FROM public.plan WHERE id=p_plan_id;
 IF v_price=0 THEN RAISE EXCEPTION 'CLOUDBOX_INVALID_PLAN_DOWNGRADE'; END IF;
 RETURN public.cloudbox_subscribe_paid_v1(p_user_id,p_plan_id,p_method_id,p_reference,p_simulate_failure);
END;
$function$;

CREATE OR REPLACE FUNCTION public.cloudbox_subscription_renew_v1(
 p_user_id integer,p_method_id integer,p_reference text,p_simulate_failure boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
 v_prior public.suscripcion%ROWTYPE;
 v_plan public.plan%ROWTYPE;
 v_active integer; v_renewed integer; v_approved integer; v_rejected integer;
 v_new_sub integer; v_payment integer; v_tx text; v_start date; v_end date;
BEGIN
 PERFORM 1 FROM public.usuario WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CLOUDBOX_USER_NOT_FOUND'; END IF;
 IF p_reference IS NULL OR p_reference !~ '^[A-Za-z0-9][A-Za-z0-9_-]{7,99}$' THEN
   RAISE EXCEPTION 'CLOUDBOX_INVALID_REFERENCE';
 END IF;
 SELECT * INTO v_prior FROM public.suscripcion
 WHERE id_usuario=p_user_id AND id_estado IN (2,3) AND fecha_fin >= CURRENT_DATE
 ORDER BY id DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CLOUDBOX_NO_ACTIVE_SUBSCRIPTION'; END IF;
 SELECT * INTO v_plan FROM public.plan WHERE id=v_prior.id_plan;
 IF NOT FOUND OR v_plan.precio <= 0 THEN RAISE EXCEPTION 'CLOUDBOX_FREE_RENEWAL_NOT_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.metodo_pago WHERE id=p_method_id AND estado IS TRUE) THEN
   RAISE EXCEPTION 'CLOUDBOX_PAYMENT_METHOD_INVALID';
 END IF;
 IF EXISTS(SELECT 1 FROM public.pago WHERE referencia=p_reference) THEN
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

CREATE OR REPLACE FUNCTION public.cloudbox_subscription_cancel_v1(p_user_id integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE v_free integer; v_cancel integer; v_active integer; v_old integer; v_new integer; v_existing integer;
BEGIN
 PERFORM 1 FROM public.usuario WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CLOUDBOX_USER_NOT_FOUND'; END IF;
 SELECT id INTO v_free FROM public.plan
 WHERE lower(btrim(nombre))='free' AND precio=0 AND espacio_maximo_gb=1 AND id_estado=1
 ORDER BY id LIMIT 1;
 IF v_free IS NULL THEN RAISE EXCEPTION 'CLOUDBOX_PLAN_UNAVAILABLE'; END IF;
 SELECT id INTO v_cancel FROM public.estado_suscripcion WHERE nombre='Cancelada';
 SELECT id INTO v_active FROM public.estado_suscripcion WHERE nombre='Activa';
 IF v_cancel IS NULL OR v_active IS NULL THEN RAISE EXCEPTION 'CLOUDBOX_STATE_NOT_FOUND'; END IF;
 SELECT id,id_plan INTO v_old,v_existing FROM public.suscripcion
 WHERE id_usuario=p_user_id AND id_estado IN (2,3) AND fecha_fin >= CURRENT_DATE
 ORDER BY id DESC LIMIT 1 FOR UPDATE;
 IF v_old IS NULL THEN RAISE EXCEPTION 'CLOUDBOX_NO_ACTIVE_SUBSCRIPTION'; END IF;
 IF v_existing=v_free THEN RAISE EXCEPTION 'CLOUDBOX_FREE_RENEWAL_NOT_REQUIRED'; END IF;
 UPDATE public.suscripcion SET id_estado=v_cancel WHERE id_usuario=p_user_id AND id_estado IN (2,3);
 INSERT INTO public.suscripcion(fecha_inicio,fecha_fin,id_usuario,id_plan,id_estado)
 VALUES(CURRENT_DATE,CURRENT_DATE+36500,p_user_id,v_free,v_active) RETURNING id INTO v_new;
 RETURN pg_catalog.jsonb_build_object('success',true,'previousSubscriptionId',v_old,
   'subscriptionId',v_new,'planId',v_free,'planName','Free','status','Activa',
   'capacityGb',1,'payment',NULL);
END;
$function$;

-- Operación programable: cambia estados según fechas sin tocar usuarios ni pagos.
-- No se configura cron automáticamente para evitar modificar infraestructura ajena.
CREATE OR REPLACE FUNCTION public.cloudbox_subscription_expire_v1()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE v_expiring integer; v_expired integer; v_active integer; v_near integer; v_late integer;
BEGIN
 SELECT id INTO v_active FROM public.estado_suscripcion WHERE nombre='Activa';
 SELECT id INTO v_expiring FROM public.estado_suscripcion WHERE nombre='PorVencer';
 SELECT id INTO v_expired FROM public.estado_suscripcion WHERE nombre='Vencida';
 IF v_active IS NULL OR v_expiring IS NULL OR v_expired IS NULL THEN RAISE EXCEPTION 'CLOUDBOX_STATE_NOT_FOUND'; END IF;
 -- No expirar el plan Free de largo plazo mientras esté en estado vigente.
 UPDATE public.suscripcion s SET id_estado=v_expired
 WHERE s.id_estado IN (v_active,v_expiring) AND s.fecha_fin < CURRENT_DATE;
 GET DIAGNOSTICS v_late=ROW_COUNT;
 UPDATE public.suscripcion s SET id_estado=v_expiring
 WHERE s.id_estado=v_active AND s.fecha_fin BETWEEN CURRENT_DATE AND CURRENT_DATE+5
 AND NOT EXISTS (SELECT 1 FROM public.plan p WHERE p.id=s.id_plan AND p.precio=0);
 GET DIAGNOSTICS v_near=ROW_COUNT;
 RETURN pg_catalog.jsonb_build_object('success',true,'expired',v_late,'expiring',v_near);
END;
$function$;

REVOKE ALL ON FUNCTION public.cloudbox_subscription_change_v1(integer,integer,integer,text,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.cloudbox_subscription_renew_v1(integer,integer,text,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.cloudbox_subscription_cancel_v1(integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.cloudbox_subscription_expire_v1() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cloudbox_subscription_change_v1(integer,integer,integer,text,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.cloudbox_subscription_renew_v1(integer,integer,text,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.cloudbox_subscription_cancel_v1(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.cloudbox_subscription_expire_v1() TO service_role;
COMMIT;
