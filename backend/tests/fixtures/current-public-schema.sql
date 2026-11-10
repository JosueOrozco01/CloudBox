-- TEST FIXTURE ONLY. Do not run against a deployed database.
-- Derived from the 29-table context supplied on 2026-11-03.
-- Preserves public columns, identity rules, CHECK, UNIQUE and foreign keys.
-- Adaptations for the test database: dependency order, integer[] placeholders,
-- actual quoted LogAuditoria name, and the referenced receipt sequence.
-- Managed auth/storage schemas and seed records are provided by the test.
CREATE SEQUENCE public.comprobante_pago_numero_seq;

CREATE TABLE public.rol (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  nombre character varying NOT NULL UNIQUE,
  descripcion text,
  estado boolean NOT NULL DEFAULT true,
  CONSTRAINT rol_pkey PRIMARY KEY (id)
);

CREATE TABLE public.estado_usuario (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  nombre character varying NOT NULL UNIQUE,
  descripcion text,
  CONSTRAINT estado_usuario_pkey PRIMARY KEY (id)
);

CREATE TABLE public.usuario (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  nombre character varying NOT NULL,
  apellido character varying NOT NULL,
  correo character varying NOT NULL UNIQUE,
  espacio_usado_by bigint NOT NULL DEFAULT 0,
  fecha_registro date NOT NULL DEFAULT CURRENT_DATE,
  id_rol integer NOT NULL,
  id_estado integer NOT NULL,
  auth_user_id uuid NOT NULL UNIQUE,
  CONSTRAINT usuario_pkey PRIMARY KEY (id),
  CONSTRAINT fk_usuario_rol FOREIGN KEY (id_rol) REFERENCES public.rol(id),
  CONSTRAINT fk_usuario_estado FOREIGN KEY (id_estado) REFERENCES public.estado_usuario(id),
  CONSTRAINT fk_usuario_auth FOREIGN KEY (auth_user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.notificacion (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  titulo character varying NOT NULL,
  mensaje text NOT NULL,
  tipo character varying,
  leida boolean NOT NULL DEFAULT false,
  fecha_creacion date NOT NULL DEFAULT CURRENT_DATE,
  id_usuario integer NOT NULL,
  tipo_recurso character varying,
  id_recurso integer,
  fecha_lectura timestamp with time zone,
  CONSTRAINT notificacion_pkey PRIMARY KEY (id),
  CONSTRAINT fk_notificacion_usuario FOREIGN KEY (id_usuario) REFERENCES public.usuario(id)
);

CREATE TABLE public.estado_plan (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  nombre character varying NOT NULL UNIQUE,
  descripcion text,
  CONSTRAINT estado_plan_pkey PRIMARY KEY (id)
);

CREATE TABLE public.plan (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  nombre character varying NOT NULL,
  descripcion text,
  precio numeric NOT NULL CHECK (precio >= 0::numeric),
  espacio_maximo_gb numeric NOT NULL CHECK (espacio_maximo_gb > 0::numeric),
  vigencia_dias integer NOT NULL CHECK (vigencia_dias > 0),
  id_estado integer NOT NULL,
  CONSTRAINT plan_pkey PRIMARY KEY (id),
  CONSTRAINT fk_plan_estado FOREIGN KEY (id_estado) REFERENCES public.estado_plan(id)
);

CREATE TABLE public.estado_suscripcion (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  nombre character varying NOT NULL UNIQUE,
  descripcion text,
  CONSTRAINT estado_suscripcion_pkey PRIMARY KEY (id)
);

CREATE TABLE public.suscripcion (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  id_usuario integer NOT NULL,
  id_plan integer NOT NULL,
  id_estado integer NOT NULL,
  CONSTRAINT suscripcion_pkey PRIMARY KEY (id),
  CONSTRAINT fk_suscripcion_plan FOREIGN KEY (id_plan) REFERENCES public.plan(id),
  CONSTRAINT fk_suscripcion_estado FOREIGN KEY (id_estado) REFERENCES public.estado_suscripcion(id),
  CONSTRAINT fk_suscripcion_usuario FOREIGN KEY (id_usuario) REFERENCES public.usuario(id)
);

CREATE TABLE public.estado_pago (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  nombre character varying NOT NULL UNIQUE,
  descripcion text,
  CONSTRAINT estado_pago_pkey PRIMARY KEY (id)
);

CREATE TABLE public.metodo_pago (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  nombre character varying NOT NULL UNIQUE,
  descripcion text,
  estado boolean NOT NULL DEFAULT true,
  CONSTRAINT metodo_pago_pkey PRIMARY KEY (id)
);

CREATE TABLE public.pago (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  monto numeric NOT NULL CHECK (monto >= 0::numeric),
  fecha_pago date NOT NULL DEFAULT CURRENT_DATE,
  referencia character varying,
  id_metodo_pago integer NOT NULL,
  id_suscripcion integer,
  id_estado integer NOT NULL,
  id_usuario integer,
  transaccion_id character varying,
  CONSTRAINT pago_pkey PRIMARY KEY (id),
  CONSTRAINT fk_pago_metodo FOREIGN KEY (id_metodo_pago) REFERENCES public.metodo_pago(id),
  CONSTRAINT fk_pago_suscripcion FOREIGN KEY (id_suscripcion) REFERENCES public.suscripcion(id),
  CONSTRAINT fk_pago_estado FOREIGN KEY (id_estado) REFERENCES public.estado_pago(id),
  CONSTRAINT pago_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuario(id)
);

CREATE TABLE public.comprobante_pago (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  numero_comprobante integer NOT NULL DEFAULT nextval('comprobante_pago_numero_seq'::regclass) UNIQUE,
  fecha_emision date NOT NULL DEFAULT CURRENT_DATE,
  monto numeric NOT NULL CHECK (monto >= 0::numeric),
  ruta_comprobante text,
  id_pago integer NOT NULL,
  CONSTRAINT comprobante_pago_pkey PRIMARY KEY (id),
  CONSTRAINT fk_comprobante_pago FOREIGN KEY (id_pago) REFERENCES public.pago(id)
);

CREATE TABLE public.extension (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  nombre character varying NOT NULL UNIQUE,
  descripcion text,
  CONSTRAINT extension_pkey PRIMARY KEY (id)
);

CREATE TABLE public.estado_archivo (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  nombre character varying NOT NULL UNIQUE,
  descripcion text,
  CONSTRAINT estado_archivo_pkey PRIMARY KEY (id)
);

CREATE TABLE public.permiso (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  nombre character varying NOT NULL UNIQUE,
  descripcion text,
  CONSTRAINT permiso_pkey PRIMARY KEY (id)
);

CREATE TABLE public.estado_compartir (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  nombre character varying NOT NULL UNIQUE,
  descripcion text,
  CONSTRAINT estado_compartir_pkey PRIMARY KEY (id)
);

CREATE TABLE public.accion (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  nombre character varying NOT NULL UNIQUE,
  descripcion text,
  CONSTRAINT accion_pkey PRIMARY KEY (id)
);

CREATE TABLE public.estado_carpeta (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  nombre character varying NOT NULL UNIQUE,
  descripcion text,
  CONSTRAINT estado_carpeta_pkey PRIMARY KEY (id)
);

CREATE TABLE public."LogAuditoria" (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  id_usuario integer,
  accion character varying NOT NULL,
  detalles text,
  ip_origen character varying,
  fecha timestamp with time zone DEFAULT now(),
  entidad_afectada character varying,
  id_entidad_afectada integer,
  detalle text,
  CONSTRAINT LogAuditoria_pkey PRIMARY KEY (id),
  CONSTRAINT LogAuditoria_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuario(id)
);

CREATE TABLE public.eliminacion_carpeta (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  id_usuario integer NOT NULL,
  id_carpeta_raiz integer NOT NULL,
  ids_carpetas integer[] NOT NULL DEFAULT '{}'::integer[],
  ids_archivos integer[] NOT NULL DEFAULT '{}'::integer[],
  fecha_eliminacion timestamp with time zone NOT NULL DEFAULT now(),
  fecha_restauracion timestamp with time zone,
  CONSTRAINT eliminacion_carpeta_pkey PRIMARY KEY (id)
);

CREATE TABLE public.credito_suscripcion (
  id_usuario integer NOT NULL,
  saldo numeric NOT NULL DEFAULT 0 CHECK (saldo >= 0::numeric),
  fecha_actualizacion timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT credito_suscripcion_pkey PRIMARY KEY (id_usuario),
  CONSTRAINT cloudbox_subscription_credit_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuario(id)
);

CREATE TABLE public.programacion_suscripcion (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  id_usuario integer NOT NULL,
  id_suscripcion_origen integer NOT NULL,
  id_suscripcion_futura integer,
  id_pago integer,
  tipo text NOT NULL CHECK (tipo = ANY (ARRAY['cancel'::text, 'downgrade'::text])),
  id_plan_destino integer NOT NULL,
  fecha_efectiva date NOT NULL,
  estado text NOT NULL DEFAULT 'pending'::text CHECK (estado = ANY (ARRAY['pending'::text, 'applied'::text, 'superseded'::text, 'error'::text])),
  fecha_creacion timestamp with time zone NOT NULL DEFAULT now(),
  fecha_aplicacion timestamp with time zone,
  CONSTRAINT programacion_suscripcion_pkey PRIMARY KEY (id),
  CONSTRAINT cloudbox_subscription_schedule_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuario(id),
  CONSTRAINT cloudbox_subscription_schedule_id_suscripcion_origen_fkey FOREIGN KEY (id_suscripcion_origen) REFERENCES public.suscripcion(id),
  CONSTRAINT cloudbox_subscription_schedule_id_suscripcion_futura_fkey FOREIGN KEY (id_suscripcion_futura) REFERENCES public.suscripcion(id),
  CONSTRAINT cloudbox_subscription_schedule_id_pago_fkey FOREIGN KEY (id_pago) REFERENCES public.pago(id),
  CONSTRAINT cloudbox_subscription_schedule_id_plan_destino_fkey FOREIGN KEY (id_plan_destino) REFERENCES public.plan(id)
);

CREATE TABLE public.evento_credito_suscripcion (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  id_usuario integer NOT NULL,
  id_suscripcion_anterior integer,
  id_suscripcion_nueva integer,
  monto_generado numeric NOT NULL DEFAULT 0,
  monto_aplicado numeric NOT NULL DEFAULT 0,
  saldo_resultante numeric NOT NULL DEFAULT 0,
  fecha timestamp with time zone NOT NULL DEFAULT now(),
  referencia text,
  CONSTRAINT evento_credito_suscripcion_pkey PRIMARY KEY (id),
  CONSTRAINT cloudbox_subscription_credit_event_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuario(id),
  CONSTRAINT cloudbox_subscription_credit_event_id_suscripcion_anterior_fkey FOREIGN KEY (id_suscripcion_anterior) REFERENCES public.suscripcion(id),
  CONSTRAINT cloudbox_subscription_credit_event_id_suscripcion_nueva_fkey FOREIGN KEY (id_suscripcion_nueva) REFERENCES public.suscripcion(id)
);

CREATE TABLE public.cloudbox_notification_event (
  id_usuario integer NOT NULL,
  tipo text NOT NULL,
  clave text NOT NULL CHECK (length(clave) >= 1 AND length(clave) <= 200),
  fecha timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cloudbox_notification_event_pkey PRIMARY KEY (id_usuario, tipo, clave),
  CONSTRAINT cloudbox_notification_event_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuario(id)
);

CREATE TABLE public.carpeta (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  nombre character varying NOT NULL,
  fecha_creacion date NOT NULL DEFAULT CURRENT_DATE,
  fecha_modificacion date NOT NULL DEFAULT CURRENT_DATE,
  id_usuario integer NOT NULL,
  id_padre integer,
  id_estado integer NOT NULL DEFAULT 1,
  CONSTRAINT carpeta_pkey PRIMARY KEY (id),
  CONSTRAINT fk_carpeta_usuario FOREIGN KEY (id_usuario) REFERENCES public.usuario(id),
  CONSTRAINT fk_carpeta_padre FOREIGN KEY (id_padre) REFERENCES public.carpeta(id),
  CONSTRAINT fk_carpeta_estado FOREIGN KEY (id_estado) REFERENCES public.estado_carpeta(id)
);

CREATE TABLE public.archivo (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  nombre character varying NOT NULL,
  tamano_bytes bigint NOT NULL CHECK (tamano_bytes >= 0),
  ruta_storage text NOT NULL,
  fecha_subida timestamp with time zone NOT NULL DEFAULT now(),
  fecha_modificacion timestamp with time zone NOT NULL DEFAULT now(),
  id_usuario integer NOT NULL,
  id_carpeta integer,
  id_extension integer NOT NULL,
  id_estado integer NOT NULL,
  CONSTRAINT archivo_pkey PRIMARY KEY (id),
  CONSTRAINT fk_archivo_usuario FOREIGN KEY (id_usuario) REFERENCES public.usuario(id),
  CONSTRAINT fk_archivo_carpeta FOREIGN KEY (id_carpeta) REFERENCES public.carpeta(id),
  CONSTRAINT fk_archivo_extension FOREIGN KEY (id_extension) REFERENCES public.extension(id),
  CONSTRAINT fk_archivo_estado FOREIGN KEY (id_estado) REFERENCES public.estado_archivo(id)
);

CREATE TABLE public.favorito (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  fecha_agregado date NOT NULL DEFAULT CURRENT_DATE,
  id_usuario integer NOT NULL,
  id_archivo integer NOT NULL,
  CONSTRAINT favorito_pkey PRIMARY KEY (id),
  CONSTRAINT fk_favorito_usuario FOREIGN KEY (id_usuario) REFERENCES public.usuario(id),
  CONSTRAINT fk_favorito_archivo FOREIGN KEY (id_archivo) REFERENCES public.archivo(id)
);

CREATE TABLE public.compartir (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  fecha_compartido date NOT NULL DEFAULT CURRENT_DATE,
  fecha_expiracion timestamp with time zone,
  id_archivo integer,
  id_carpeta integer,
  id_usuario_emisor integer NOT NULL,
  id_usuario_receptor integer NOT NULL,
  id_permiso integer NOT NULL,
  id_estado integer NOT NULL,
  CONSTRAINT compartir_pkey PRIMARY KEY (id),
  CONSTRAINT fk_compartir_emisor FOREIGN KEY (id_usuario_emisor) REFERENCES public.usuario(id),
  CONSTRAINT fk_compartir_receptor FOREIGN KEY (id_usuario_receptor) REFERENCES public.usuario(id),
  CONSTRAINT fk_compartir_permiso FOREIGN KEY (id_permiso) REFERENCES public.permiso(id),
  CONSTRAINT fk_compartir_estado FOREIGN KEY (id_estado) REFERENCES public.estado_compartir(id),
  CONSTRAINT fk_compartir_archivo FOREIGN KEY (id_archivo) REFERENCES public.archivo(id),
  CONSTRAINT fk_compartir_carpeta FOREIGN KEY (id_carpeta) REFERENCES public.carpeta(id)
);

CREATE TABLE public.actividad (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  fecha timestamp with time zone NOT NULL DEFAULT now(),
  descripcion text NOT NULL,
  id_usuario integer NOT NULL,
  id_archivo integer,
  id_accion integer NOT NULL,
  id_carpeta integer,
  CONSTRAINT actividad_pkey PRIMARY KEY (id),
  CONSTRAINT fk_actividad_usuario FOREIGN KEY (id_usuario) REFERENCES public.usuario(id),
  CONSTRAINT fk_actividad_accion FOREIGN KEY (id_accion) REFERENCES public.accion(id),
  CONSTRAINT fk_actividad_archivo FOREIGN KEY (id_archivo) REFERENCES public.archivo(id),
  CONSTRAINT fk_actividad_carpeta FOREIGN KEY (id_carpeta) REFERENCES public.carpeta(id)
);
