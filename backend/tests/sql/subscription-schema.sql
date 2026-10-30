-- LOCAL ONLY. CloudBox public schema supplied by the user on 2026-10-25.
-- Ordered for FK creation; ARRAY corrected to integer[]. No production data.
-- auth.users is a dependency stub: Supabase Auth internals were not supplied.
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
CREATE TABLE public.rol(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,nombre varchar NOT NULL UNIQUE,descripcion text,estado boolean NOT NULL DEFAULT true);
CREATE TABLE public.estado_usuario(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,nombre varchar NOT NULL UNIQUE,descripcion text);
CREATE TABLE public.usuario(
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,nombre varchar NOT NULL,apellido varchar NOT NULL,
 correo varchar NOT NULL UNIQUE,espacio_usado_by bigint NOT NULL DEFAULT 0,fecha_registro date NOT NULL DEFAULT CURRENT_DATE,
 id_rol integer NOT NULL,id_estado integer NOT NULL,auth_user_id uuid NOT NULL UNIQUE,
 CONSTRAINT fk_usuario_rol FOREIGN KEY(id_rol) REFERENCES public.rol(id),
 CONSTRAINT fk_usuario_estado FOREIGN KEY(id_estado) REFERENCES public.estado_usuario(id),
 CONSTRAINT fk_usuario_auth FOREIGN KEY(auth_user_id) REFERENCES auth.users(id));
CREATE TABLE public.notificacion(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,titulo varchar NOT NULL,mensaje text NOT NULL,tipo varchar,leida boolean NOT NULL DEFAULT false,fecha_creacion date NOT NULL DEFAULT CURRENT_DATE,id_usuario integer NOT NULL,CONSTRAINT fk_notificacion_usuario FOREIGN KEY(id_usuario) REFERENCES public.usuario(id));
CREATE TABLE public.estado_plan(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,nombre varchar NOT NULL UNIQUE,descripcion text);
CREATE TABLE public.plan(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,nombre varchar NOT NULL,descripcion text,precio numeric NOT NULL CHECK(precio>=0),espacio_maximo_gb numeric NOT NULL CHECK(espacio_maximo_gb>0),vigencia_dias integer NOT NULL CHECK(vigencia_dias>0),id_estado integer NOT NULL,CONSTRAINT fk_plan_estado FOREIGN KEY(id_estado) REFERENCES public.estado_plan(id));
CREATE TABLE public.estado_suscripcion(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,nombre varchar NOT NULL UNIQUE,descripcion text);
CREATE TABLE public.suscripcion(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,fecha_inicio date NOT NULL,fecha_fin date NOT NULL,id_usuario integer NOT NULL,id_plan integer NOT NULL,id_estado integer NOT NULL,
 CONSTRAINT fk_suscripcion_plan FOREIGN KEY(id_plan) REFERENCES public.plan(id),CONSTRAINT fk_suscripcion_estado FOREIGN KEY(id_estado) REFERENCES public.estado_suscripcion(id),CONSTRAINT fk_suscripcion_usuario FOREIGN KEY(id_usuario) REFERENCES public.usuario(id));
CREATE TABLE public.estado_pago(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,nombre varchar NOT NULL UNIQUE,descripcion text);
CREATE TABLE public.metodo_pago(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,nombre varchar NOT NULL UNIQUE,descripcion text,estado boolean NOT NULL DEFAULT true);
CREATE TABLE public.pago(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,monto numeric NOT NULL CHECK(monto>=0),fecha_pago date NOT NULL DEFAULT CURRENT_DATE,referencia varchar,id_metodo_pago integer NOT NULL,id_suscripcion integer,id_estado integer NOT NULL,id_usuario integer,transaccion_id varchar,
 CONSTRAINT fk_pago_metodo FOREIGN KEY(id_metodo_pago) REFERENCES public.metodo_pago(id),CONSTRAINT fk_pago_suscripcion FOREIGN KEY(id_suscripcion) REFERENCES public.suscripcion(id),CONSTRAINT fk_pago_estado FOREIGN KEY(id_estado) REFERENCES public.estado_pago(id),CONSTRAINT pago_usuario_fkey FOREIGN KEY(id_usuario) REFERENCES public.usuario(id));
CREATE SEQUENCE public.comprobante_pago_numero_seq START 100001;
CREATE TABLE public.comprobante_pago(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,numero_comprobante integer NOT NULL DEFAULT nextval('public.comprobante_pago_numero_seq') UNIQUE,fecha_emision date NOT NULL DEFAULT CURRENT_DATE,monto numeric NOT NULL CHECK(monto>=0),ruta_comprobante text,id_pago integer NOT NULL,CONSTRAINT fk_comprobante_pago FOREIGN KEY(id_pago) REFERENCES public.pago(id));
CREATE TABLE public.extension(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,nombre varchar NOT NULL UNIQUE,descripcion text);
CREATE TABLE public.estado_archivo(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,nombre varchar NOT NULL UNIQUE,descripcion text);
CREATE TABLE public.estado_carpeta(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,nombre varchar NOT NULL UNIQUE,descripcion text);
CREATE TABLE public.carpeta(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,nombre varchar NOT NULL,fecha_creacion date NOT NULL DEFAULT CURRENT_DATE,fecha_modificacion date NOT NULL DEFAULT CURRENT_DATE,id_usuario integer NOT NULL,id_padre integer,id_estado integer NOT NULL DEFAULT 1,
 CONSTRAINT fk_carpeta_usuario FOREIGN KEY(id_usuario) REFERENCES public.usuario(id),CONSTRAINT fk_carpeta_padre FOREIGN KEY(id_padre) REFERENCES public.carpeta(id),CONSTRAINT fk_carpeta_estado FOREIGN KEY(id_estado) REFERENCES public.estado_carpeta(id));
CREATE TABLE public.archivo(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,nombre varchar NOT NULL,tamano_bytes bigint NOT NULL CHECK(tamano_bytes>=0),ruta_storage text NOT NULL,fecha_subida timestamptz NOT NULL DEFAULT now(),fecha_modificacion timestamptz NOT NULL DEFAULT now(),id_usuario integer NOT NULL,id_carpeta integer,id_extension integer NOT NULL,id_estado integer NOT NULL,
 CONSTRAINT fk_archivo_usuario FOREIGN KEY(id_usuario) REFERENCES public.usuario(id),CONSTRAINT fk_archivo_carpeta FOREIGN KEY(id_carpeta) REFERENCES public.carpeta(id),CONSTRAINT fk_archivo_extension FOREIGN KEY(id_extension) REFERENCES public.extension(id),CONSTRAINT fk_archivo_estado FOREIGN KEY(id_estado) REFERENCES public.estado_archivo(id));
CREATE TABLE public.favorito(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,fecha_agregado date NOT NULL DEFAULT CURRENT_DATE,id_usuario integer NOT NULL,id_archivo integer NOT NULL,CONSTRAINT fk_favorito_usuario FOREIGN KEY(id_usuario) REFERENCES public.usuario(id),CONSTRAINT fk_favorito_archivo FOREIGN KEY(id_archivo) REFERENCES public.archivo(id));
CREATE TABLE public.permiso(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,nombre varchar NOT NULL UNIQUE,descripcion text);
CREATE TABLE public.estado_compartir(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,nombre varchar NOT NULL UNIQUE,descripcion text);
CREATE TABLE public.compartir(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,fecha_compartido date NOT NULL DEFAULT CURRENT_DATE,fecha_expiracion timestamptz,id_archivo integer,id_carpeta integer,id_usuario_emisor integer NOT NULL,id_usuario_receptor integer NOT NULL,id_permiso integer NOT NULL,id_estado integer NOT NULL,
 CONSTRAINT fk_compartir_emisor FOREIGN KEY(id_usuario_emisor) REFERENCES public.usuario(id),CONSTRAINT fk_compartir_receptor FOREIGN KEY(id_usuario_receptor) REFERENCES public.usuario(id),CONSTRAINT fk_compartir_permiso FOREIGN KEY(id_permiso) REFERENCES public.permiso(id),CONSTRAINT fk_compartir_estado FOREIGN KEY(id_estado) REFERENCES public.estado_compartir(id),CONSTRAINT fk_compartir_archivo FOREIGN KEY(id_archivo) REFERENCES public.archivo(id),CONSTRAINT fk_compartir_carpeta FOREIGN KEY(id_carpeta) REFERENCES public.carpeta(id));
CREATE TABLE public.accion(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,nombre varchar NOT NULL UNIQUE,descripcion text);
CREATE TABLE public.actividad(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,fecha timestamptz NOT NULL DEFAULT now(),descripcion text NOT NULL,id_usuario integer NOT NULL,id_archivo integer,id_accion integer NOT NULL,id_carpeta integer,
 CONSTRAINT fk_actividad_usuario FOREIGN KEY(id_usuario) REFERENCES public.usuario(id),CONSTRAINT fk_actividad_accion FOREIGN KEY(id_accion) REFERENCES public.accion(id),CONSTRAINT fk_actividad_archivo FOREIGN KEY(id_archivo) REFERENCES public.archivo(id),CONSTRAINT fk_actividad_carpeta FOREIGN KEY(id_carpeta) REFERENCES public.carpeta(id));
-- Quoted to preserve Supabase's actual case-sensitive LogAuditoria API name.
CREATE TABLE public."LogAuditoria"(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,id_usuario integer,accion varchar NOT NULL,detalles text,ip_origen varchar,fecha timestamptz DEFAULT now(),entidad_afectada varchar,id_entidad_afectada integer,detalle text,CONSTRAINT "LogAuditoria_id_usuario_fkey" FOREIGN KEY(id_usuario) REFERENCES public.usuario(id));
CREATE TABLE public.eliminacion_carpeta(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,id_usuario integer NOT NULL,id_carpeta_raiz integer NOT NULL,ids_carpetas integer[] NOT NULL DEFAULT '{}',ids_archivos integer[] NOT NULL DEFAULT '{}',fecha_eliminacion timestamptz NOT NULL DEFAULT now(),fecha_restauracion timestamptz);
CREATE TABLE public.cloudbox_subscription_credit(id_usuario integer PRIMARY KEY,saldo numeric NOT NULL DEFAULT 0 CHECK(saldo>=0),fecha_actualizacion timestamptz NOT NULL DEFAULT now(),CONSTRAINT cloudbox_subscription_credit_id_usuario_fkey FOREIGN KEY(id_usuario) REFERENCES public.usuario(id));
CREATE TABLE public.cloudbox_subscription_schedule(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,id_usuario integer NOT NULL,id_suscripcion_origen integer NOT NULL,id_suscripcion_futura integer,id_pago integer,tipo text NOT NULL CHECK(tipo IN ('cancel','downgrade')),id_plan_destino integer NOT NULL,fecha_efectiva date NOT NULL,estado text NOT NULL DEFAULT 'pending' CHECK(estado IN ('pending','applied','superseded','error')),fecha_creacion timestamptz NOT NULL DEFAULT now(),fecha_aplicacion timestamptz,
 CONSTRAINT cloudbox_subscription_schedule_id_usuario_fkey FOREIGN KEY(id_usuario) REFERENCES public.usuario(id),CONSTRAINT cloudbox_subscription_schedule_id_suscripcion_origen_fkey FOREIGN KEY(id_suscripcion_origen) REFERENCES public.suscripcion(id),CONSTRAINT cloudbox_subscription_schedule_id_suscripcion_futura_fkey FOREIGN KEY(id_suscripcion_futura) REFERENCES public.suscripcion(id),CONSTRAINT cloudbox_subscription_schedule_id_pago_fkey FOREIGN KEY(id_pago) REFERENCES public.pago(id),CONSTRAINT cloudbox_subscription_schedule_id_plan_destino_fkey FOREIGN KEY(id_plan_destino) REFERENCES public.plan(id));
CREATE TABLE public.cloudbox_subscription_credit_event(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,id_usuario integer NOT NULL,id_suscripcion_anterior integer,id_suscripcion_nueva integer,monto_generado numeric NOT NULL DEFAULT 0,monto_aplicado numeric NOT NULL DEFAULT 0,saldo_resultante numeric NOT NULL DEFAULT 0,fecha timestamptz NOT NULL DEFAULT now(),referencia text,
 CONSTRAINT cloudbox_subscription_credit_event_id_usuario_fkey FOREIGN KEY(id_usuario) REFERENCES public.usuario(id),CONSTRAINT cloudbox_subscription_credit_event_id_suscripcion_anterior_fkey FOREIGN KEY(id_suscripcion_anterior) REFERENCES public.suscripcion(id),CONSTRAINT cloudbox_subscription_credit_event_id_suscripcion_nueva_fkey FOREIGN KEY(id_suscripcion_nueva) REFERENCES public.suscripcion(id));
-- Only synthetic test records. Stable catalog IDs match the Phase 7 business contract.
INSERT INTO public.rol(nombre) VALUES('Cliente');
INSERT INTO public.estado_usuario(nombre) VALUES('Activo');
INSERT INTO public.estado_plan(nombre) VALUES('Activo');
INSERT INTO public.plan(id,nombre,precio,espacio_maximo_gb,vigencia_dias,id_estado) OVERRIDING SYSTEM VALUE VALUES(8,'Free',0,1,36500,1),(1,'Básico',29,5,30,1),(2,'Pro',89,50,30,1),(3,'Premium',149,100,30,1);
INSERT INTO public.estado_suscripcion(nombre) VALUES('Pendiente'),('Activa'),('PorVencer'),('Vencida'),('Renovada'),('Cancelada');
INSERT INTO public.estado_pago(nombre) VALUES('Aprobado'),('Rechazado');
INSERT INTO public.metodo_pago(nombre) VALUES('Simulado');
INSERT INTO auth.users SELECT md5('local-test-user-'||i)::uuid FROM generate_series(101,112) i;
INSERT INTO public.usuario(id,nombre,apellido,correo,id_rol,id_estado,auth_user_id) OVERRIDING SYSTEM VALUE SELECT i,'Prueba','Local','local-'||i||'@example.invalid',1,1,md5('local-test-user-'||i)::uuid FROM generate_series(101,112) i;
INSERT INTO public.suscripcion(fecha_inicio,fecha_fin,id_usuario,id_plan,id_estado) SELECT CURRENT_DATE-15,CURRENT_DATE+15,i,1,2 FROM generate_series(101,109) i;
