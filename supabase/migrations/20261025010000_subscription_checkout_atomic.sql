-- CloudBox Fase 7: version de checkout verificada mediante pg_get_functiondef.
-- Instalacion de la funcion y permisos; no modifica datos hasta recibir una llamada RPC.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.suscripcion_usuario_vigente_unica_fase7') IS NULL THEN
    RAISE EXCEPTION 'Falta indice de unicidad de suscripciones vigentes';
  END IF;
  IF to_regclass('public.pago_referencia_unique_not_null') IS NULL THEN
    RAISE EXCEPTION 'Falta indice de unicidad de referencia de pago';
  END IF;
END $$;

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

  SELECT * INTO v_plan FROM public.plan WHERE id = p_plan_id;
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

  IF v_previous_plan_id = v_plan.id THEN
    RAISE EXCEPTION 'CLOUDBOX_SAME_PLAN_REQUIRES_RENEWAL';
  END IF;

  -- Ademas del indice unico, comprobar la referencia antes de escribir.
  IF EXISTS (SELECT 1 FROM public.pago WHERE referencia = p_reference) THEN
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
  SET id_estado = v_canceled_state
  WHERE id_usuario = p_user_id
    AND id_estado IN (v_active_state, v_expiring_state);

  INSERT INTO public.suscripcion
    (fecha_inicio, fecha_fin, id_usuario, id_plan, id_estado)
  VALUES
    (CURRENT_DATE, CURRENT_DATE + v_plan.vigencia_dias,
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
    'endDate', CURRENT_DATE + v_plan.vigencia_dias,
    'payment', pg_catalog.jsonb_build_object(
      'paymentId', v_payment_id, 'amount', v_amount,
      'transactionId', v_transaction, 'referenceCode', p_reference,
      'status', 'Aprobado'
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.cloudbox_subscribe_paid_v1(integer,integer,integer,text,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cloudbox_subscribe_paid_v1(integer,integer,integer,text,boolean) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cloudbox_subscribe_paid_v1(integer,integer,integer,text,boolean) TO service_role;
COMMIT;
