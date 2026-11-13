-- Extracto local del esquema real exportado. Solo datos ficticios y auth.uid simulado.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
CREATE TABLE public.rol(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,nombre varchar(100) NOT NULL UNIQUE,descripcion text,estado boolean NOT NULL DEFAULT true);
CREATE TABLE public.estado_usuario(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,nombre varchar(100) NOT NULL UNIQUE,descripcion text);
CREATE TABLE public.usuario(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,nombre varchar(100) NOT NULL,apellido varchar(100) NOT NULL,correo varchar(255) NOT NULL UNIQUE,
 espacio_usado_by bigint NOT NULL DEFAULT 0,fecha_registro date NOT NULL DEFAULT CURRENT_DATE,id_rol integer NOT NULL REFERENCES public.rol,id_estado integer NOT NULL REFERENCES public.estado_usuario,auth_user_id uuid NOT NULL UNIQUE REFERENCES auth.users);
CREATE TABLE public.notificacion(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,titulo varchar(255) NOT NULL,mensaje text NOT NULL,tipo varchar(100),leida boolean NOT NULL DEFAULT false,fecha_creacion date NOT NULL DEFAULT CURRENT_DATE,id_usuario integer NOT NULL REFERENCES public.usuario);
CREATE TABLE public.estado_plan(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,nombre varchar(100) NOT NULL UNIQUE);
CREATE TABLE public.plan(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,nombre varchar(100) NOT NULL,precio numeric(10,2) NOT NULL CHECK(precio>=0),espacio_maximo_gb numeric(10,2) NOT NULL CHECK(espacio_maximo_gb>0),vigencia_dias integer NOT NULL CHECK(vigencia_dias>0),id_estado integer NOT NULL REFERENCES public.estado_plan);
CREATE TABLE public.estado_suscripcion(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,nombre varchar(100) NOT NULL UNIQUE);
CREATE TABLE public.suscripcion(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,fecha_inicio date NOT NULL,fecha_fin date NOT NULL,id_usuario integer NOT NULL REFERENCES public.usuario,id_plan integer NOT NULL REFERENCES public.plan,id_estado integer NOT NULL REFERENCES public.estado_suscripcion);
CREATE TABLE public.estado_pago(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,nombre varchar(100) NOT NULL UNIQUE);
CREATE TABLE public.metodo_pago(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,nombre varchar(100) NOT NULL UNIQUE,estado boolean NOT NULL DEFAULT true);
CREATE TABLE public.pago(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,monto numeric(10,2) NOT NULL CHECK(monto>=0),fecha_pago date NOT NULL DEFAULT CURRENT_DATE,referencia varchar(255),id_metodo_pago integer NOT NULL REFERENCES public.metodo_pago,id_suscripcion integer REFERENCES public.suscripcion,id_estado integer NOT NULL REFERENCES public.estado_pago,id_usuario integer REFERENCES public.usuario,transaccion_id varchar(255));
CREATE TABLE public.estado_carpeta(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,nombre varchar NOT NULL UNIQUE);
CREATE TABLE public.carpeta(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,nombre varchar(255) NOT NULL,id_usuario integer NOT NULL REFERENCES public.usuario,id_estado integer NOT NULL REFERENCES public.estado_carpeta);
CREATE TABLE public.estado_archivo(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,nombre varchar NOT NULL UNIQUE);
CREATE TABLE public.archivo(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,nombre varchar(255) NOT NULL,id_usuario integer NOT NULL REFERENCES public.usuario,id_estado integer NOT NULL REFERENCES public.estado_archivo);
CREATE TABLE public.permiso(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,nombre varchar NOT NULL UNIQUE);
CREATE TABLE public.estado_compartir(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,nombre varchar NOT NULL UNIQUE);
CREATE TABLE public.compartir(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,fecha_compartido date NOT NULL DEFAULT CURRENT_DATE,fecha_expiracion timestamptz,
 id_archivo integer REFERENCES public.archivo,id_carpeta integer REFERENCES public.carpeta,id_usuario_emisor integer NOT NULL REFERENCES public.usuario,id_usuario_receptor integer NOT NULL REFERENCES public.usuario,id_permiso integer NOT NULL REFERENCES public.permiso,id_estado integer NOT NULL REFERENCES public.estado_compartir);
CREATE TABLE public."LogAuditoria"(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,id_usuario integer REFERENCES public.usuario,accion varchar(100) NOT NULL,detalle text);
CREATE TABLE public.accion(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,nombre varchar(100) NOT NULL UNIQUE);
CREATE TABLE public.actividad(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,fecha timestamptz NOT NULL DEFAULT now(),descripcion text NOT NULL,id_usuario integer NOT NULL REFERENCES public.usuario,
 id_archivo integer REFERENCES public.archivo,id_carpeta integer REFERENCES public.carpeta,id_accion integer NOT NULL REFERENCES public.accion);
INSERT INTO public.rol(nombre) VALUES('Cliente'),('Administrador');
INSERT INTO public.estado_usuario(nombre) VALUES('Activo'),('Inactivo');
INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000010'),('00000000-0000-0000-0000-000000000020');
INSERT INTO public.usuario(id,nombre,apellido,correo,id_rol,id_estado,auth_user_id) OVERRIDING SYSTEM VALUE VALUES
 (10,'Prueba','Uno','uno@local.invalid',1,1,'00000000-0000-0000-0000-000000000010'),(20,'Prueba','Dos','dos@local.invalid',2,1,'00000000-0000-0000-0000-000000000020');
INSERT INTO public.estado_plan(nombre) VALUES('Activo'),('Inactivo');
INSERT INTO public.plan(id,nombre,precio,espacio_maximo_gb,vigencia_dias,id_estado) OVERRIDING SYSTEM VALUE VALUES(8,'Free',0,1,36500,1),(1,'Básico',9,5,30,1);
INSERT INTO public.estado_suscripcion(nombre) VALUES('Pendiente'),('Activa'),('PorVencer'),('Vencida'),('Renovada'),('Cancelada');
INSERT INTO public.estado_pago(nombre) VALUES('Aprobado'),('Rechazado');
INSERT INTO public.metodo_pago(nombre) VALUES('Simulado');
INSERT INTO public.estado_carpeta(nombre) VALUES('Activo'),('Papelera');
INSERT INTO public.estado_archivo(nombre) VALUES('Activo'),('En papelera');
INSERT INTO public.archivo(nombre,id_usuario,id_estado) VALUES('Ficticio',20,1);
INSERT INTO public.carpeta(nombre,id_usuario,id_estado) VALUES('Ficticia',20,1);
INSERT INTO public.permiso(nombre) VALUES('Editor'),('Lector');
INSERT INTO public.estado_compartir(nombre) VALUES('Activo'),('Revocado');
INSERT INTO public.accion(nombre) VALUES('Subir archivo'),('Compartir archivo');
INSERT INTO public.actividad(id_usuario,id_accion,descripcion,fecha) VALUES(10,1,'Propia','2026-10-25T00:00:00Z'),(10,1,'Propia final','2026-10-25T23:59:59.999Z'),(20,1,'Ajena','2026-10-25T12:00:00Z'),(10,2,'Otra acción','2026-10-26T00:00:00Z');
INSERT INTO public.notificacion(titulo,mensaje,tipo,leida,fecha_creacion,id_usuario) VALUES
 (repeat('x',255),'Histórico leído','TIPO_ANTIGUO',true,'2026-01-01',10),('Histórico sin leer','Preservar',NULL,false,'2026-01-02',20);
-- ACL/RLS efectivos compatibles con etapa 1; no se vuelve a ejecutar su SQL.
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT SELECT ON public.usuario,public.rol,public.estado_usuario,public.estado_carpeta TO authenticated;
GRANT SELECT ON public.estado_carpeta TO anon;
GRANT UPDATE(nombre,apellido) ON public.usuario TO authenticated;
GRANT ALL ON public.notificacion TO anon,authenticated;
ALTER TABLE public.notificacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suscripcion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compartir ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actividad ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON public.usuario FOR SELECT TO authenticated USING(auth.uid()=auth_user_id);
CREATE POLICY "Users can update own profile" ON public.usuario FOR UPDATE TO authenticated USING(auth.uid()=auth_user_id) WITH CHECK(auth.uid()=auth_user_id);
