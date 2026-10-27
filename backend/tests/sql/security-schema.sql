-- SOLO PRUEBAS LOCALES: extracto estructural del catalogo exportado 2026-10-27.
-- auth.uid es un doble local; no sustituye Supabase Auth ni sus JWT reales.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
CREATE TABLE public.rol(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,nombre varchar(100) NOT NULL UNIQUE,descripcion text,estado boolean NOT NULL DEFAULT true);
CREATE TABLE public.estado_usuario(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,nombre varchar(100) NOT NULL UNIQUE,descripcion text);
CREATE TABLE public.usuario(
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,nombre varchar(100) NOT NULL,
  apellido varchar(100) NOT NULL,correo varchar(255) NOT NULL UNIQUE,
  espacio_usado_by bigint NOT NULL DEFAULT 0,fecha_registro date NOT NULL DEFAULT CURRENT_DATE,
  id_rol integer NOT NULL REFERENCES public.rol,id_estado integer NOT NULL REFERENCES public.estado_usuario,
  auth_user_id uuid NOT NULL UNIQUE REFERENCES auth.users
);
CREATE TABLE public."LogAuditoria"(
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,id_usuario integer REFERENCES public.usuario,
  accion varchar(100) NOT NULL,detalles text,ip_origen varchar(50),fecha timestamptz DEFAULT now(),
  entidad_afectada varchar(100),id_entidad_afectada integer,detalle text
);
CREATE TABLE public.estado_carpeta(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,nombre varchar NOT NULL UNIQUE,descripcion text);
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon,authenticated,service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon,authenticated,service_role;
ALTER TABLE public.usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rol ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estado_usuario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON public.usuario FOR SELECT TO authenticated USING(auth_user_id=auth.uid());
CREATE POLICY "Users can update own profile" ON public.usuario FOR UPDATE TO authenticated USING(auth.uid()=auth_user_id) WITH CHECK(auth.uid()=auth_user_id);
CREATE POLICY "Authenticated users can read roles" ON public.rol FOR SELECT TO authenticated USING(true);
CREATE POLICY "Authenticated users can read user statuses" ON public.estado_usuario FOR SELECT TO authenticated USING(true);
INSERT INTO public.rol(nombre) VALUES ('Cliente'),('Administrador');
INSERT INTO public.estado_usuario(nombre) VALUES ('Activo'),('Inactivo');
INSERT INTO public.estado_carpeta(nombre) VALUES ('Activo'),('Papelera');
INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
INSERT INTO public.usuario(nombre,apellido,correo,id_rol,id_estado,auth_user_id) VALUES
  ('Uno','Apellido','uno@local.invalid',1,1,'00000000-0000-0000-0000-000000000001'),
  ('Dos','Apellido','dos@local.invalid',1,1,'00000000-0000-0000-0000-000000000002');
INSERT INTO public."LogAuditoria"(id_usuario,accion,detalle) VALUES (1,'EXISTENTE','conservar');
