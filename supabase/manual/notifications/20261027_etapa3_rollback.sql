-- CONTINGENCIA MANUAL: desactiva solo productores; conserva avisos, leida, columnas y deduplicacion.
-- No revierte datos ni cambios de etapa 1/2; no restaura grants amplios de clientes.
BEGIN;
SET LOCAL lock_timeout='10s';
DO $guard$ BEGIN
 IF to_regprocedure('public.cloudbox_notification_create_v1(integer,text,text,text,text,integer,text)') IS NOT NULL AND (SELECT md5(replace(prosrc,E'\r\n',E'\n')) FROM pg_proc WHERE oid=to_regprocedure('public.cloudbox_notification_create_v1(integer,text,text,text,text,integer,text)')) IS DISTINCT FROM '53f6ce3ec194cc38358c8955a50f597e' THEN RAISE EXCEPTION 'Deriva de public.cloudbox_notification_create_v1(integer,text,text,text,text,integer,text)'; END IF;
 IF to_regprocedure('public.cloudbox_not_share()') IS NOT NULL AND (SELECT md5(replace(prosrc,E'\r\n',E'\n')) FROM pg_proc WHERE oid=to_regprocedure('public.cloudbox_not_share()')) IS DISTINCT FROM '77848cafb545cc4f738036b12c8d689e' THEN RAISE EXCEPTION 'Deriva de public.cloudbox_not_share()'; END IF;
 IF to_regprocedure('public.cloudbox_not_payment()') IS NOT NULL AND (SELECT md5(replace(prosrc,E'\r\n',E'\n')) FROM pg_proc WHERE oid=to_regprocedure('public.cloudbox_not_payment()')) IS DISTINCT FROM '107bceb7d5cacaf7abe3306ba92ec7dd' THEN RAISE EXCEPTION 'Deriva de public.cloudbox_not_payment()'; END IF;
 IF to_regprocedure('public.cloudbox_not_subscription()') IS NOT NULL AND (SELECT md5(replace(prosrc,E'\r\n',E'\n')) FROM pg_proc WHERE oid=to_regprocedure('public.cloudbox_not_subscription()')) IS DISTINCT FROM '870f2d67dba5718c88789723fdc43d72' THEN RAISE EXCEPTION 'Deriva de public.cloudbox_not_subscription()'; END IF;
 IF to_regprocedure('public.cloudbox_not_storage()') IS NOT NULL AND (SELECT md5(replace(prosrc,E'\r\n',E'\n')) FROM pg_proc WHERE oid=to_regprocedure('public.cloudbox_not_storage()')) IS DISTINCT FROM '8b5ce82b48aec91b0b0f92e465ccd920' THEN RAISE EXCEPTION 'Deriva de public.cloudbox_not_storage()'; END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.compartir'::regclass AND tgname='cloudbox_not_share' AND tgfoid IS DISTINCT FROM to_regprocedure('public.cloudbox_not_share()')) THEN RAISE EXCEPTION 'Conflicto de trigger cloudbox_not_share'; END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.pago'::regclass AND tgname='cloudbox_not_payment' AND tgfoid IS DISTINCT FROM to_regprocedure('public.cloudbox_not_payment()')) THEN RAISE EXCEPTION 'Conflicto de trigger cloudbox_not_payment'; END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.suscripcion'::regclass AND tgname='cloudbox_not_subscription' AND tgfoid IS DISTINCT FROM to_regprocedure('public.cloudbox_not_subscription()')) THEN RAISE EXCEPTION 'Conflicto de trigger cloudbox_not_subscription'; END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.usuario'::regclass AND tgname='cloudbox_not_storage' AND tgfoid IS DISTINCT FROM to_regprocedure('public.cloudbox_not_storage()')) THEN RAISE EXCEPTION 'Conflicto de trigger cloudbox_not_storage'; END IF;
END; $guard$;
DROP TRIGGER IF EXISTS cloudbox_not_share ON public.compartir;
DROP TRIGGER IF EXISTS cloudbox_not_payment ON public.pago;
DROP TRIGGER IF EXISTS cloudbox_not_subscription ON public.suscripcion;
DROP TRIGGER IF EXISTS cloudbox_not_storage ON public.usuario;
COMMIT;
