-- REVISION MANUAL. Tabla real existente; leida es la autoridad. Sin backfill de lecturas.
-- Independiente de las RPC comerciales antiguas/nuevas. No ejecuta etapa 2 ni cambia Free.
BEGIN;
SET LOCAL lock_timeout='10s';
DO $preflight$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.notificacion'::regclass AND attname='leida' AND atttypid='boolean'::regtype AND attnotnull) THEN
   RAISE EXCEPTION 'No coincide notificacion.leida real'; END IF;
 IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.notificacion'::regclass AND
   ((attname IN ('id','id_usuario') AND atttypid<>'integer'::regtype) OR
    (attname='fecha_creacion' AND atttypid<>'date'::regtype))) THEN RAISE EXCEPTION 'Deriva del esquema real notificacion'; END IF;
 IF to_regclass('public.cloudbox_notification_event') IS NOT NULL AND
   obj_description(to_regclass('public.cloudbox_notification_event'),'pg_class') IS DISTINCT FROM 'CloudBox notification dedup v1' THEN
   RAISE EXCEPTION 'Conflicto de tabla de deduplicacion'; END IF;

 IF to_regprocedure('public.cloudbox_notification_create_v1(integer,text,text,text,text,integer,text)') IS NOT NULL AND (SELECT md5(replace(prosrc,E'\r\n',E'\n')) FROM pg_proc WHERE oid=to_regprocedure('public.cloudbox_notification_create_v1(integer,text,text,text,text,integer,text)')) IS DISTINCT FROM '53f6ce3ec194cc38358c8955a50f597e' THEN RAISE EXCEPTION 'Deriva de public.cloudbox_notification_create_v1(integer,text,text,text,text,integer,text)'; END IF;
 IF to_regprocedure('public.cloudbox_not_share()') IS NOT NULL AND (SELECT md5(replace(prosrc,E'\r\n',E'\n')) FROM pg_proc WHERE oid=to_regprocedure('public.cloudbox_not_share()')) IS DISTINCT FROM '77848cafb545cc4f738036b12c8d689e' THEN RAISE EXCEPTION 'Deriva de public.cloudbox_not_share()'; END IF;
 IF to_regprocedure('public.cloudbox_not_payment()') IS NOT NULL AND (SELECT md5(replace(prosrc,E'\r\n',E'\n')) FROM pg_proc WHERE oid=to_regprocedure('public.cloudbox_not_payment()')) IS DISTINCT FROM '107bceb7d5cacaf7abe3306ba92ec7dd' THEN RAISE EXCEPTION 'Deriva de public.cloudbox_not_payment()'; END IF;
 IF to_regprocedure('public.cloudbox_not_subscription()') IS NOT NULL AND (SELECT md5(replace(prosrc,E'\r\n',E'\n')) FROM pg_proc WHERE oid=to_regprocedure('public.cloudbox_not_subscription()')) IS DISTINCT FROM '870f2d67dba5718c88789723fdc43d72' THEN RAISE EXCEPTION 'Deriva de public.cloudbox_not_subscription()'; END IF;
 IF to_regprocedure('public.cloudbox_not_storage()') IS NOT NULL AND (SELECT md5(replace(prosrc,E'\r\n',E'\n')) FROM pg_proc WHERE oid=to_regprocedure('public.cloudbox_not_storage()')) IS DISTINCT FROM '8b5ce82b48aec91b0b0f92e465ccd920' THEN RAISE EXCEPTION 'Deriva de public.cloudbox_not_storage()'; END IF;
 IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.notificacion'::regclass AND NOT attisdropped AND ((attname='fecha_lectura' AND atttypid<>'timestamptz'::regtype) OR (attname='id_recurso' AND atttypid<>'integer'::regtype) OR (attname='tipo_recurso' AND atttypid<>'varchar'::regtype))) THEN RAISE EXCEPTION 'Conflicto en columnas de extension'; END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.compartir'::regclass AND tgname='cloudbox_not_share' AND tgfoid IS DISTINCT FROM to_regprocedure('public.cloudbox_not_share()')) THEN RAISE EXCEPTION 'Conflicto de trigger cloudbox_not_share'; END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.pago'::regclass AND tgname='cloudbox_not_payment' AND tgfoid IS DISTINCT FROM to_regprocedure('public.cloudbox_not_payment()')) THEN RAISE EXCEPTION 'Conflicto de trigger cloudbox_not_payment'; END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.suscripcion'::regclass AND tgname='cloudbox_not_subscription' AND tgfoid IS DISTINCT FROM to_regprocedure('public.cloudbox_not_subscription()')) THEN RAISE EXCEPTION 'Conflicto de trigger cloudbox_not_subscription'; END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.usuario'::regclass AND tgname='cloudbox_not_storage' AND tgfoid IS DISTINCT FROM to_regprocedure('public.cloudbox_not_storage()')) THEN RAISE EXCEPTION 'Conflicto de trigger cloudbox_not_storage'; END IF;
END; $preflight$;

ALTER TABLE public.notificacion ADD COLUMN IF NOT EXISTS tipo_recurso varchar(100),
 ADD COLUMN IF NOT EXISTS id_recurso integer,
 ADD COLUMN IF NOT EXISTS fecha_lectura timestamptz;
-- No modificar fecha_creacion DATE ni tipo/titulo/mensaje/FK/identity existentes.
CREATE INDEX IF NOT EXISTS cloudbox_notification_user_date ON public.notificacion(id_usuario,fecha_creacion DESC,id DESC);
CREATE INDEX IF NOT EXISTS cloudbox_notification_unread ON public.notificacion(id_usuario,id DESC) WHERE NOT leida;

-- Registro de idempotencia, no cola: persiste al borrar una notificacion de la bandeja.
CREATE TABLE IF NOT EXISTS public.cloudbox_notification_event(
 id_usuario integer NOT NULL REFERENCES public.usuario(id), tipo text NOT NULL,
 clave text NOT NULL CHECK(length(clave) BETWEEN 1 AND 200), fecha timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(id_usuario,tipo,clave)
);
DO $ledger$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.cloudbox_notification_event'::regclass AND contype='p' AND pg_get_constraintdef(oid)='PRIMARY KEY (id_usuario, tipo, clave)') THEN RAISE EXCEPTION 'Deduplicacion sin clave esperada'; END IF;
END; $ledger$;
COMMENT ON TABLE public.cloudbox_notification_event IS 'CloudBox notification dedup v1';
ALTER TABLE public.cloudbox_notification_event ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cloudbox_notification_event,public.notificacion FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.notificacion TO service_role;
GRANT SELECT,INSERT ON public.cloudbox_notification_event TO service_role;
DO $acl$ DECLARE col record; seq text; BEGIN
 FOR col IN SELECT attrelid::regclass AS target,attname FROM pg_attribute WHERE attrelid IN('public.notificacion'::regclass,'public.cloudbox_notification_event'::regclass) AND attnum>0 AND NOT attisdropped LOOP
   EXECUTE format('REVOKE ALL PRIVILEGES (%I) ON %s FROM PUBLIC,anon,authenticated',col.attname,col.target);
 END LOOP;
 seq:=pg_get_serial_sequence('public.notificacion','id');
 IF seq IS NOT NULL THEN
   EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC,anon,authenticated',seq);
   EXECUTE format('GRANT USAGE,SELECT ON SEQUENCE %s TO service_role',seq);
 END IF;
END; $acl$;

CREATE OR REPLACE FUNCTION public.cloudbox_notification_create_v1(
 p_user_id integer,p_type text,p_title text,p_message text,
 p_resource_type text DEFAULT NULL,p_resource_id integer DEFAULT NULL,p_key text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET timezone='UTC' AS $fn$
DECLARE claimed integer; result jsonb;
BEGIN
 IF p_user_id IS NULL OR p_user_id<1 OR p_type IS NULL OR p_type NOT IN
 ('FILE_SHARED','FOLDER_SHARED','ACCESS_REVOKED','PAYMENT_APPROVED','SUBSCRIPTION_ACTIVATED','SUBSCRIPTION_EXPIRING','STORAGE_NEAR_LIMIT')
 OR p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 1 AND 255
 OR p_message IS NULL OR length(btrim(p_message)) NOT BETWEEN 1 AND 2000
 OR (p_resource_type IS NOT NULL AND p_resource_type NOT IN ('archivo','carpeta','pago','suscripcion','almacenamiento'))
 OR (p_resource_id IS NOT NULL AND p_resource_id<1)
 OR (p_key IS NOT NULL AND length(btrim(p_key)) NOT BETWEEN 1 AND 200) THEN
   RAISE EXCEPTION 'CLOUDBOX_NOTIFICATION_INVALID'; END IF;
 IF p_key IS NOT NULL THEN
   INSERT INTO public.cloudbox_notification_event(id_usuario,tipo,clave) VALUES(p_user_id,p_type,p_key)
    ON CONFLICT DO NOTHING RETURNING id_usuario INTO claimed;
   IF claimed IS NULL THEN RETURN NULL; END IF;
 END IF;
 INSERT INTO public.notificacion(id_usuario,tipo,titulo,mensaje,tipo_recurso,id_recurso,leida)
 VALUES(p_user_id,p_type,btrim(p_title),p_message,p_resource_type,p_resource_id,false)
 RETURNING to_jsonb(notificacion) INTO result;
 RETURN result;
END; $fn$;

CREATE OR REPLACE FUNCTION public.cloudbox_not_share() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET timezone='UTC' AS $fn$
DECLARE kind text; target integer; event text;
BEGIN
 IF TG_OP='INSERT' THEN
   IF num_nonnulls(NEW.id_archivo,NEW.id_carpeta)<>1 THEN RETURN NEW; END IF;
 ELSIF OLD.id_estado=1 AND NEW.id_estado=2 THEN
   IF num_nonnulls(OLD.id_archivo,OLD.id_carpeta)<>1 THEN RETURN NEW; END IF;
 ELSIF num_nonnulls(NEW.id_archivo,NEW.id_carpeta)<>1 THEN RETURN NEW; END IF;
 kind:=CASE WHEN NEW.id_archivo IS NOT NULL THEN 'archivo' ELSE 'carpeta' END;
 target:=coalesce(NEW.id_archivo,NEW.id_carpeta);
 IF NEW.id_estado=1 AND (TG_OP='INSERT' OR OLD.id_estado IS DISTINCT FROM NEW.id_estado)
   AND (NEW.fecha_expiracion IS NULL OR NEW.fecha_expiracion>now()) THEN
   event:=CASE WHEN kind='archivo' THEN 'FILE_SHARED' ELSE 'FOLDER_SHARED' END;
   PERFORM public.cloudbox_notification_create_v1(NEW.id_usuario_receptor,event,'Recurso compartido',
    'Se ha compartido un recurso contigo.',kind,target,'share:'||NEW.id||':tx:'||txid_current());
 ELSIF TG_OP='UPDATE' AND OLD.id_estado=1 AND NEW.id_estado=2 THEN
   kind:=CASE WHEN OLD.id_archivo IS NOT NULL THEN 'archivo' ELSE 'carpeta' END;
   target:=coalesce(OLD.id_archivo,OLD.id_carpeta);
   PERFORM public.cloudbox_notification_create_v1(OLD.id_usuario_receptor,'ACCESS_REVOKED','Acceso revocado',
    'Se ha revocado tu acceso a un recurso.',kind,target,'revoke:'||NEW.id||':tx:'||txid_current());
 END IF;
 RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'CloudBox notification share producer failed'; RETURN NEW;
END; $fn$;

CREATE OR REPLACE FUNCTION public.cloudbox_not_payment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET timezone='UTC' AS $fn$
DECLARE recipient integer;
BEGIN
 IF NEW.id_estado=(SELECT id FROM public.estado_pago WHERE nombre='Aprobado') AND NEW.monto>0
   AND (TG_OP='INSERT' OR OLD.id_estado IS DISTINCT FROM NEW.id_estado) THEN
   recipient:=coalesce(NEW.id_usuario,(SELECT id_usuario FROM public.suscripcion WHERE id=NEW.id_suscripcion));
   IF recipient IS NOT NULL THEN
     PERFORM public.cloudbox_notification_create_v1(recipient,'PAYMENT_APPROVED','Pago aprobado',
       'Tu pago ha sido aprobado.','pago',NEW.id,'payment:'||NEW.id);
   END IF;
 END IF;
 RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'CloudBox notification payment producer failed'; RETURN NEW;
END; $fn$;

CREATE OR REPLACE FUNCTION public.cloudbox_not_subscription() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET timezone='UTC' AS $fn$
DECLARE active integer; near integer;
BEGIN
 SELECT id INTO active FROM public.estado_suscripcion WHERE nombre='Activa';
 SELECT id INTO near FROM public.estado_suscripcion WHERE nombre='PorVencer';
 IF active IS NULL OR near IS NULL THEN RAISE EXCEPTION 'CLOUDBOX_NOTIFICATION_STATES_UNAVAILABLE'; END IF;
 IF NEW.fecha_inicio>CURRENT_DATE OR NEW.fecha_fin<CURRENT_DATE OR NEW.id_estado NOT IN(active,near) THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' OR OLD.id_estado NOT IN(active,near) THEN
   PERFORM public.cloudbox_notification_create_v1(NEW.id_usuario,'SUBSCRIPTION_ACTIVATED','Suscripción activada',
    'Tu suscripción está activa.','suscripcion',NEW.id,'subscription:'||NEW.id);
 END IF;
 IF NEW.id_estado=near AND EXISTS(SELECT 1 FROM public.plan WHERE id=NEW.id_plan AND precio>0)
   AND (TG_OP='INSERT' OR OLD.id_estado IS DISTINCT FROM NEW.id_estado OR OLD.fecha_fin IS DISTINCT FROM NEW.fecha_fin) THEN
   PERFORM public.cloudbox_notification_create_v1(NEW.id_usuario,'SUBSCRIPTION_EXPIRING','Suscripción próxima a vencer',
    'Tu suscripción está próxima a vencer.','suscripcion',NEW.id,'expiring:'||NEW.id||':'||NEW.fecha_fin);
 END IF;
 RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'CloudBox notification subscription producer failed'; RETURN NEW;
END; $fn$;

CREATE OR REPLACE FUNCTION public.cloudbox_not_storage() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET timezone='UTC' AS $fn$
DECLARE capacity numeric; subscription integer; selected_plan integer;
BEGIN
 SELECT s.id,p.id,p.espacio_maximo_gb*1073741824 INTO subscription,selected_plan,capacity
 FROM public.suscripcion s JOIN public.plan p ON p.id=s.id_plan WHERE s.id_usuario=NEW.id
 AND s.id_estado IN(2,3) AND s.fecha_inicio<=CURRENT_DATE AND s.fecha_fin>=CURRENT_DATE
 ORDER BY s.id DESC LIMIT 1;
 IF capacity IS NULL THEN
   SELECT id,espacio_maximo_gb*1073741824 INTO selected_plan,capacity FROM public.plan
   WHERE lower(btrim(nombre))='free' AND precio=0 AND espacio_maximo_gb=1 AND id_estado=1 ORDER BY id LIMIT 1;
 END IF;
 IF capacity>0 AND NEW.espacio_usado_by>=capacity*0.9 THEN
   PERFORM public.cloudbox_notification_create_v1(NEW.id,'STORAGE_NEAR_LIMIT','Almacenamiento próximo al límite',
     'Has utilizado al menos el 90% de tu almacenamiento.','almacenamiento',NEW.id,
     'storage:'||NEW.id||':'||coalesce('subscription:'||subscription,'free:'||selected_plan));
 END IF;
 RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'CloudBox notification storage producer failed'; RETURN NEW;
END; $fn$;

DROP TRIGGER IF EXISTS cloudbox_not_share ON public.compartir;
CREATE TRIGGER cloudbox_not_share AFTER INSERT OR UPDATE OF id_estado ON public.compartir FOR EACH ROW EXECUTE FUNCTION public.cloudbox_not_share();
DROP TRIGGER IF EXISTS cloudbox_not_payment ON public.pago;
CREATE TRIGGER cloudbox_not_payment AFTER INSERT OR UPDATE OF id_estado ON public.pago FOR EACH ROW EXECUTE FUNCTION public.cloudbox_not_payment();
DROP TRIGGER IF EXISTS cloudbox_not_subscription ON public.suscripcion;
CREATE TRIGGER cloudbox_not_subscription AFTER INSERT OR UPDATE OF id_estado,fecha_fin ON public.suscripcion FOR EACH ROW EXECUTE FUNCTION public.cloudbox_not_subscription();
DROP TRIGGER IF EXISTS cloudbox_not_storage ON public.usuario;
CREATE TRIGGER cloudbox_not_storage AFTER UPDATE OF espacio_usado_by ON public.usuario FOR EACH ROW EXECUTE FUNCTION public.cloudbox_not_storage();
REVOKE ALL ON FUNCTION public.cloudbox_notification_create_v1(integer,text,text,text,text,integer,text),
 public.cloudbox_not_share(),public.cloudbox_not_payment(),public.cloudbox_not_subscription(),public.cloudbox_not_storage() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cloudbox_notification_create_v1(integer,text,text,text,text,integer,text) TO service_role;
DO $permissions$ DECLARE client text; BEGIN
 FOREACH client IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF has_table_privilege(client,'public.notificacion','SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
     OR has_any_column_privilege(client,'public.notificacion','SELECT,INSERT,UPDATE')
     OR has_table_privilege(client,'public.cloudbox_notification_event','SELECT,INSERT,UPDATE,DELETE')
     OR has_any_column_privilege(client,'public.cloudbox_notification_event','SELECT,INSERT,UPDATE')
     OR has_function_privilege(client,'public.cloudbox_notification_create_v1(integer,text,text,text,text,integer,text)','EXECUTE') THEN
     RAISE EXCEPTION 'Permisos heredados inesperados para %',client;
   END IF;
 END LOOP;
END; $permissions$;
-- La nueva RPC/columnas deben ser visibles para la Data API tras el commit.
NOTIFY pgrst, 'reload schema';
COMMIT;
