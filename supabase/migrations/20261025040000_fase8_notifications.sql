BEGIN;
CREATE TABLE public.notificacion (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 id_usuario integer NOT NULL REFERENCES public.usuario(id) ON DELETE CASCADE,
 tipo text NOT NULL CHECK (tipo IN ('FILE_SHARED','FOLDER_SHARED','ACCESS_REVOKED','PAYMENT_APPROVED','SUBSCRIPTION_ACTIVATED','SUBSCRIPTION_EXPIRING','STORAGE_NEAR_LIMIT')),
 titulo text NOT NULL CHECK (length(btrim(titulo)) BETWEEN 1 AND 200),
 mensaje text NOT NULL CHECK (length(btrim(mensaje)) BETWEEN 1 AND 2000),
 tipo_recurso text CHECK (tipo_recurso IN ('archivo','carpeta','pago','suscripcion','almacenamiento')),
 id_recurso bigint CHECK (id_recurso > 0),
 fecha_creacion timestamptz NOT NULL DEFAULT now(),
 fecha_lectura timestamptz,
 clave_deduplicacion text CHECK (length(btrim(clave_deduplicacion)) BETWEEN 1 AND 200)
);
CREATE INDEX notificacion_usuario_fecha ON public.notificacion(id_usuario, fecha_creacion DESC, id DESC);
CREATE UNIQUE INDEX notificacion_transicion_unica ON public.notificacion(id_usuario,tipo,clave_deduplicacion) WHERE clave_deduplicacion IS NOT NULL;
ALTER TABLE public.notificacion ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notificacion FROM anon, authenticated;
GRANT ALL ON public.notificacion TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.notificacion_id_seq TO service_role;
COMMIT;
