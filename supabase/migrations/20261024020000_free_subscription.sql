-- CloudBox Fase 7: Free 1 GB, suscripciones persistidas sin pago.
-- EJECUTAR MANUALMENTE en Supabase SQL Editor. Revisar el SELECT final.
-- No altera Básico, Pro, Premium ni Starter.
BEGIN;

-- Evita altas simultáneas de planes Free durante esta migración.
LOCK TABLE public.plan IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
  v_free_id integer;
  v_next_id integer;
  v_id_default text;
BEGIN
  SELECT id INTO v_free_id FROM public.plan WHERE lower(trim(nombre)) = 'free' ORDER BY id LIMIT 1;
  IF v_free_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.plan WHERE id = v_free_id
      AND precio = 0 AND espacio_maximo_gb = 1 AND id_estado = 1
    ) THEN
      RAISE EXCEPTION 'Ya existe Free, pero no tiene precio Q0 / 1 GB / activo. Revisar antes de continuar.';
    END IF;
  ELSE
    SELECT column_default INTO v_id_default
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='plan' AND column_name='id';

    IF v_id_default IS NOT NULL OR EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='plan' AND column_name='id'
      AND is_identity='YES'
    ) THEN
      INSERT INTO public.plan (nombre,descripcion,precio,espacio_maximo_gb,vigencia_dias,id_estado)
      VALUES ('Free','Almacenamiento gratuito de 1 GB',0,1,36500,1);
    ELSE
      SELECT coalesce(max(id),0)+1 INTO v_next_id FROM public.plan;
      INSERT INTO public.plan (id,nombre,descripcion,precio,espacio_maximo_gb,vigencia_dias,id_estado)
      VALUES (v_next_id,'Free','Almacenamiento gratuito de 1 GB',0,1,36500,1);
    END IF;
  END IF;
END $$;

-- Estados reales confirmados: Activa=2, PorVencer=3.
-- Impide más de una suscripción vigente por usuario, incluso bajo concurrencia.
CREATE UNIQUE INDEX IF NOT EXISTS suscripcion_usuario_vigente_unica_fase7
ON public.suscripcion (id_usuario)
WHERE id_estado IN (2,3);

-- Asigna Free únicamente a perfiles nuevos SIN ninguna suscripción previa.
-- No reemplaza contratos pagados y no crea pagos.
CREATE OR REPLACE FUNCTION public.cloudbox_assign_free_after_user_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_free_id integer;
BEGIN
  SELECT id INTO v_free_id FROM public.plan
  WHERE lower(trim(nombre)) = 'free' AND precio = 0
    AND espacio_maximo_gb = 1 AND id_estado = 1
  ORDER BY id LIMIT 1;
  IF v_free_id IS NULL THEN
    RAISE EXCEPTION 'Plan Free de 1 GB no disponible';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.suscripcion WHERE id_usuario = NEW.id) THEN
    INSERT INTO public.suscripcion (id_usuario,id_plan,id_estado,fecha_inicio,fecha_fin)
    VALUES (NEW.id,v_free_id,2,now(),now() + interval '100 years');
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.cloudbox_assign_free_after_user_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cloudbox_assign_free_after_user_insert() FROM anon, authenticated;

DROP TRIGGER IF EXISTS cloudbox_user_free_subscription_after_insert ON public.usuario;
CREATE TRIGGER cloudbox_user_free_subscription_after_insert
AFTER INSERT ON public.usuario
FOR EACH ROW EXECUTE FUNCTION public.cloudbox_assign_free_after_user_insert();

-- Backfill conservador: usuarios existentes SIN ningún registro histórico.
-- No reactiva a usuarios con suscripciones canceladas/vencidas ni cambia planes pagos.
INSERT INTO public.suscripcion (id_usuario,id_plan,id_estado,fecha_inicio,fecha_fin)
SELECT u.id, p.id, 2, now(), now() + interval '100 years'
FROM public.usuario u
CROSS JOIN LATERAL (
  SELECT id FROM public.plan
  WHERE lower(trim(nombre))='free' AND precio=0 AND espacio_maximo_gb=1 AND id_estado=1
  ORDER BY id LIMIT 1
) p
WHERE NOT EXISTS (SELECT 1 FROM public.suscripcion s WHERE s.id_usuario=u.id)
ON CONFLICT DO NOTHING;

COMMIT;

-- Solo lectura: comprobar tras ejecutar.
SELECT id,nombre,precio,espacio_maximo_gb,vigencia_dias,id_estado
FROM public.plan ORDER BY id;
SELECT id_plan,id_estado,count(*) AS cantidad FROM public.suscripcion
GROUP BY id_plan,id_estado ORDER BY id_plan,id_estado;
