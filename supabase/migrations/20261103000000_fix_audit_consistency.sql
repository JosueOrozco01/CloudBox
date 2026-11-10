BEGIN;

-- Conserva los datos si una instalación anterior creó las tablas en inglés.
-- Si existen ambos nombres, se interrumpe la transacción para evitar separarlos.
DO $$
DECLARE mapeo record; secuencia text;
BEGIN
  FOR mapeo IN SELECT * FROM (VALUES
    ('admin_notification_read','notificacion_administrador'),
    ('support_ticket','solicitud_soporte'),
    ('support_message','mensaje_soporte'),
    ('cloudbox_storage_cleanup','limpieza_almacenamiento')
  ) AS nombres(anterior,nuevo) LOOP
    IF to_regclass(format('public.%I',mapeo.anterior)) IS NULL THEN CONTINUE; END IF;
    IF to_regclass(format('public.%I',mapeo.nuevo)) IS NOT NULL THEN
      RAISE EXCEPTION 'CLOUDBOX_CONFLICTO_NOMBRE_TABLA: existen % y %',mapeo.anterior,mapeo.nuevo;
    END IF;
    EXECUTE format('ALTER TABLE public.%I RENAME TO %I',mapeo.anterior,mapeo.nuevo);
    IF mapeo.anterior<>'admin_notification_read' THEN
      secuencia:=pg_get_serial_sequence(format('public.%I',mapeo.nuevo),'id');
      IF secuencia IS NOT NULL AND secuencia<>format('public.%I',mapeo.nuevo||'_id_seq') THEN
        EXECUTE format('ALTER SEQUENCE %s RENAME TO %I',secuencia,mapeo.nuevo||'_id_seq');
      END IF;
    END IF;
  END LOOP;
  FOR mapeo IN SELECT * FROM (VALUES
    ('support_ticket_user_date','solicitud_soporte_usuario_fecha'),
    ('support_message_ticket','mensaje_soporte_solicitud')
  ) AS nombres(anterior,nuevo) LOOP
    IF to_regclass(format('public.%I',mapeo.anterior)) IS NOT NULL
      AND to_regclass(format('public.%I',mapeo.nuevo)) IS NULL THEN
      EXECUTE format('ALTER INDEX public.%I RENAME TO %I',mapeo.anterior,mapeo.nuevo);
    END IF;
  END LOOP;
END; $$;

-- Reconcile optional integrations even when an older installation omitted them.
CREATE TABLE IF NOT EXISTS public.notificacion_administrador (
  id_usuario integer NOT NULL REFERENCES public.usuario(id) ON DELETE CASCADE,
  id_log bigint NOT NULL REFERENCES public."LogAuditoria"(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(id_usuario,id_log)
);
CREATE TABLE IF NOT EXISTS public.solicitud_soporte (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_usuario integer NOT NULL REFERENCES public.usuario(id),
  subject text NOT NULL CHECK(length(btrim(subject)) BETWEEN 3 AND 150),
  category text NOT NULL CHECK(category IN ('files','sharing','storage','payments','security','other')),
  status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','closed')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.mensaje_soporte (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_id bigint NOT NULL REFERENCES public.solicitud_soporte(id) ON DELETE CASCADE,
  id_usuario integer NOT NULL REFERENCES public.usuario(id),
  message text NOT NULL CHECK(length(btrim(message)) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS solicitud_soporte_usuario_fecha ON public.solicitud_soporte(id_usuario,created_at DESC);
CREATE INDEX IF NOT EXISTS mensaje_soporte_solicitud ON public.mensaje_soporte(ticket_id,id);
ALTER TABLE public.notificacion_administrador ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitud_soporte ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensaje_soporte ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notificacion_administrador,public.solicitud_soporte,public.mensaje_soporte FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.notificacion_administrador,public.solicitud_soporte,public.mensaje_soporte TO service_role;
REVOKE ALL ON SEQUENCE public.solicitud_soporte_id_seq,public.mensaje_soporte_id_seq FROM PUBLIC,anon,authenticated;
GRANT USAGE,SELECT ON SEQUENCE public.solicitud_soporte_id_seq,public.mensaje_soporte_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.cloudbox_create_ticket(p_user integer,p_subject text,p_category text,p_message text)
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE ticket bigint;
BEGIN
  INSERT INTO public.solicitud_soporte(id_usuario,subject,category) VALUES(p_user,btrim(p_subject),p_category) RETURNING id INTO ticket;
  INSERT INTO public.mensaje_soporte(ticket_id,id_usuario,message) VALUES(ticket,p_user,btrim(p_message));
  RETURN ticket;
END; $$;
REVOKE ALL ON FUNCTION public.cloudbox_create_ticket(integer,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cloudbox_create_ticket(integer,text,text,text) TO service_role;

-- A reply and a status transition serialize on the same ticket row.
CREATE OR REPLACE FUNCTION public.cloudbox_support_message_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE ticket_status text;
BEGIN
  SELECT status INTO ticket_status FROM public.solicitud_soporte WHERE id=NEW.ticket_id FOR UPDATE;
  IF ticket_status='closed' THEN RAISE EXCEPTION 'CLOUDBOX_TICKET_CLOSED'; END IF;
  UPDATE public.solicitud_soporte SET updated_at=now() WHERE id=NEW.ticket_id;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS cloudbox_support_message_guard ON public.mensaje_soporte;
CREATE TRIGGER cloudbox_support_message_guard BEFORE INSERT ON public.mensaje_soporte
FOR EACH ROW EXECUTE FUNCTION public.cloudbox_support_message_guard();
REVOKE ALL ON FUNCTION public.cloudbox_support_message_guard() FROM PUBLIC,anon,authenticated;

-- NULL means physical deletion is unconfirmed. Old deleted rows remain retryable
-- until Storage confirms removal; never assume that an object was deleted.
ALTER TABLE public.archivo ADD COLUMN IF NOT EXISTS storage_deleted_at timestamptz;
CREATE TABLE IF NOT EXISTS public.limpieza_almacenamiento (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  storage_path text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.limpieza_almacenamiento ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.limpieza_almacenamiento FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.limpieza_almacenamiento TO service_role;
REVOKE ALL ON SEQUENCE public.limpieza_almacenamiento_id_seq FROM PUBLIC,anon,authenticated;
GRANT USAGE,SELECT ON SEQUENCE public.limpieza_almacenamiento_id_seq TO service_role;
CREATE INDEX IF NOT EXISTS archivo_pending_storage_delete ON public.archivo(id_usuario,id)
WHERE id_estado=3 AND storage_deleted_at IS NULL;

-- Lock the owner row before changing file usage. This also coordinates with
-- commercial operations that lock usuario, and works across backend instances.
CREATE OR REPLACE FUNCTION public.cloudbox_file_quota_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET timezone='UTC' AS $$
DECLARE old_bytes bigint:=0; new_bytes bigint:=0; used_bytes bigint; capacity bigint;
        active_count integer; today date:=(now() AT TIME ZONE 'UTC')::date;
BEGIN
  IF TG_OP='UPDATE' AND OLD.id_usuario<>NEW.id_usuario THEN
    RAISE EXCEPTION 'CLOUDBOX_FILE_OWNER_CHANGE_FORBIDDEN';
  END IF;
  PERFORM id FROM public.usuario WHERE id=NEW.id_usuario FOR UPDATE;
  IF TG_OP='UPDATE' AND (OLD.id_estado IN (1,2) OR (OLD.id_estado=3 AND OLD.storage_deleted_at IS NULL)) THEN old_bytes:=OLD.tamano_bytes; END IF;
  IF NEW.id_estado IN (1,2) OR (NEW.id_estado=3 AND NEW.storage_deleted_at IS NULL) THEN new_bytes:=NEW.tamano_bytes; END IF;
  IF new_bytes<=old_bytes THEN RETURN NEW; END IF;
  IF NEW.tamano_bytes<1 OR NEW.tamano_bytes>52428800 THEN RAISE EXCEPTION 'CLOUDBOX_INVALID_FILE_SIZE'; END IF;
  SELECT count(*),min((p.espacio_maximo_gb::numeric*1073741824)::bigint)
    INTO active_count,capacity
    FROM public.suscripcion s JOIN public.plan p ON p.id=s.id_plan
    JOIN public.estado_suscripcion e ON e.id=s.id_estado
    WHERE s.id_usuario=NEW.id_usuario AND e.nombre IN ('Activa','PorVencer')
      AND s.fecha_inicio<=today AND (s.fecha_fin IS NULL OR s.fecha_fin>=today);
  IF active_count>1 THEN RAISE EXCEPTION 'CLOUDBOX_MULTIPLE_ACTIVE_SUBSCRIPTIONS'; END IF;
  IF active_count=0 THEN
    SELECT (espacio_maximo_gb::numeric*1073741824)::bigint INTO capacity FROM public.plan
      WHERE lower(btrim(nombre))='free' AND precio=0 AND espacio_maximo_gb=1 AND id_estado=1
      ORDER BY id LIMIT 1;
  END IF;
  IF capacity IS NULL THEN RAISE EXCEPTION 'CLOUDBOX_FREE_PLAN_UNAVAILABLE'; END IF;
  SELECT coalesce(sum(tamano_bytes),0) INTO used_bytes FROM public.archivo
    WHERE id_usuario=NEW.id_usuario AND id IS DISTINCT FROM NEW.id
      AND (id_estado IN (1,2) OR (id_estado=3 AND storage_deleted_at IS NULL));
  IF used_bytes+new_bytes>capacity THEN RAISE EXCEPTION 'CLOUDBOX_STORAGE_QUOTA_EXCEEDED'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS cloudbox_file_quota_guard ON public.archivo;
CREATE TRIGGER cloudbox_file_quota_guard BEFORE INSERT OR UPDATE ON public.archivo
FOR EACH ROW EXECUTE FUNCTION public.cloudbox_file_quota_guard();
REVOKE ALL ON FUNCTION public.cloudbox_file_quota_guard() FROM PUBLIC,anon,authenticated;

-- Persist options in Auth metadata; the producer below covers both API calls
-- Serialize folder writes too; concurrent moves must not introduce cycles.
CREATE OR REPLACE FUNCTION public.cloudbox_folder_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF TG_OP='UPDATE' AND OLD.id_usuario<>NEW.id_usuario THEN RAISE EXCEPTION 'CLOUDBOX_FOLDER_PARENT_INVALID'; END IF;
  PERFORM id FROM public.usuario WHERE id=NEW.id_usuario FOR UPDATE;
  IF NEW.id_estado<>1 THEN RETURN NEW; END IF;
  IF NEW.id_padre IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.carpeta WHERE id=NEW.id_padre AND id_usuario=NEW.id_usuario) THEN
    RAISE EXCEPTION 'CLOUDBOX_FOLDER_PARENT_INVALID';
  END IF;
  IF EXISTS(WITH RECURSIVE ancestors AS (
    SELECT id,id_padre FROM public.carpeta WHERE id=NEW.id_padre
    UNION SELECT c.id,c.id_padre FROM public.carpeta c JOIN ancestors a ON c.id=a.id_padre
  ) SELECT 1 FROM ancestors WHERE id=NEW.id) OR NEW.id_padre=NEW.id THEN RAISE EXCEPTION 'CLOUDBOX_FOLDER_CYCLE'; END IF;
  IF EXISTS(SELECT 1 FROM public.carpeta WHERE id_usuario=NEW.id_usuario AND id_estado=1 AND id IS DISTINCT FROM NEW.id
    AND id_padre IS NOT DISTINCT FROM NEW.id_padre AND nombre=btrim(NEW.nombre)) THEN RAISE EXCEPTION 'CLOUDBOX_FOLDER_DUPLICATE'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS cloudbox_folder_guard ON public.carpeta;
CREATE TRIGGER cloudbox_folder_guard BEFORE INSERT OR UPDATE ON public.carpeta
FOR EACH ROW EXECUTE FUNCTION public.cloudbox_folder_guard();
REVOKE ALL ON FUNCTION public.cloudbox_folder_guard() FROM PUBLIC,anon,authenticated;

-- Check parent availability at commit, allowing a cascade to restore children
-- and parents in either order within the same transaction.
CREATE OR REPLACE FUNCTION public.cloudbox_folder_parent_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.carpeta c LEFT JOIN public.carpeta p ON p.id=c.id_padre
    WHERE c.id_estado=1 AND c.id_padre IS NOT NULL AND (c.id=NEW.id OR c.id_padre=NEW.id)
    AND (p.id IS NULL OR p.id_estado<>1 OR p.id_usuario<>c.id_usuario)) THEN
    RAISE EXCEPTION 'CLOUDBOX_FOLDER_PARENT_INVALID';
  END IF;
  RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS cloudbox_folder_parent_guard ON public.carpeta;
CREATE CONSTRAINT TRIGGER cloudbox_folder_parent_guard AFTER INSERT OR UPDATE ON public.carpeta
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.cloudbox_folder_parent_guard();
REVOKE ALL ON FUNCTION public.cloudbox_folder_parent_guard() FROM PUBLIC,anon,authenticated;

-- Persist options in Auth metadata; the producer below covers both API calls
-- and database triggers. Absent options preserve the pre-existing delivery rule.
CREATE OR REPLACE FUNCTION public.cloudbox_notification_preference_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE preferences jsonb; category text; item jsonb;
BEGIN
  category:=CASE
    WHEN NEW.tipo IN ('FILE_SHARED','FOLDER_SHARED','ACCESS_REVOKED') THEN 'shared'
    WHEN NEW.tipo IN ('SUBSCRIPTION_ACTIVATED','SUBSCRIPTION_EXPIRING') THEN 'renewal'
    WHEN NEW.tipo='STORAGE_NEAR_LIMIT' THEN 'storage'
    WHEN NEW.tipo='PAYMENT_APPROVED' THEN 'activity'
    ELSE NULL END;
  IF category IS NULL THEN RETURN NEW; END IF;
  SELECT a.raw_user_meta_data->'cloudbox_preferences'->'notifications' INTO preferences
    FROM auth.users a JOIN public.usuario u ON u.auth_user_id=a.id WHERE u.id=NEW.id_usuario;
  IF jsonb_typeof(preferences)='array' THEN
    FOR item IN SELECT value FROM jsonb_array_elements(preferences) LOOP
      IF item->>'id'=category AND item->'enabled'='false'::jsonb THEN RETURN NULL; END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS cloudbox_notification_preference_guard ON public.notificacion;
CREATE TRIGGER cloudbox_notification_preference_guard BEFORE INSERT ON public.notificacion
FOR EACH ROW EXECUTE FUNCTION public.cloudbox_notification_preference_guard();
REVOKE ALL ON FUNCTION public.cloudbox_notification_preference_guard() FROM PUBLIC,anon,authenticated;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('avatars','avatars',false,2097152,ARRAY['image/jpeg','image/png','image/webp']) ON CONFLICT(id) DO NOTHING;
NOTIFY pgrst,'reload schema';
COMMIT;
