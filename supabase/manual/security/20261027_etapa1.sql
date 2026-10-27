-- REVISION MANUAL. Basado en catalogos reales exportados el 2026-10-27.
-- No ejecutar como migracion historica ni mediante el backend.
-- No cambia datos, politicas, funciones, triggers, propietarios ni RLS.
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $security$
DECLARE
  target regclass;
  client text;
  column_name text;
  sequence_name text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role' AND (rolbypassrls OR rolsuper)) THEN
    RAISE EXCEPTION 'Revisar capacidad RLS de service_role antes de aplicar';
  END IF;
  FOREACH client IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=client AND NOT rolsuper AND NOT rolbypassrls)
      OR pg_has_role(client,'service_role','USAGE') THEN
      RAISE EXCEPTION 'Revisar atributos/herencia del rol % antes de aplicar', client;
    END IF;
  END LOOP;
  IF NOT has_schema_privilege('authenticated','public','USAGE') THEN
    RAISE EXCEPTION 'Falta USAGE de authenticated en public; revisar catalogo actual';
  END IF;
  IF NOT (SELECT relrowsecurity AND NOT relforcerowsecurity FROM pg_class WHERE oid='public.usuario'::regclass) THEN
    RAISE EXCEPTION 'RLS de usuario difiere del catalogo revisado';
  END IF;
  -- Conservar exactamente la frontera de propiedad ya verificada.
  IF (SELECT count(*) FROM pg_policy WHERE polrelid='public.usuario'::regclass AND polcmd IN ('w','*')) <> 1
    OR NOT EXISTS (
      SELECT 1 FROM pg_policy WHERE polrelid='public.usuario'::regclass
      AND polname='Users can update own profile' AND polcmd='w' AND polpermissive
      AND polroles=ARRAY[(SELECT oid FROM pg_roles WHERE rolname='authenticated')]
      AND regexp_replace(pg_get_expr(polqual,polrelid),'[[:space:]()]','','g') IN ('auth.uid=auth_user_id','auth_user_id=auth.uid')
      AND regexp_replace(pg_get_expr(polwithcheck,polrelid),'[[:space:]()]','','g') IN ('auth.uid=auth_user_id','auth_user_id=auth.uid')
    ) THEN
    RAISE EXCEPTION 'Politicas UPDATE de usuario difieren; revisar antes de aplicar';
  END IF;

  REVOKE ALL PRIVILEGES ON TABLE public."LogAuditoria" FROM PUBLIC, anon, authenticated;
  REVOKE UPDATE ON TABLE public.usuario FROM PUBLIC, anon, authenticated;
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.estado_carpeta FROM PUBLIC, anon, authenticated;

  -- Los permisos por columna son independientes de los permisos de tabla.
  FOREACH target IN ARRAY ARRAY['public."LogAuditoria"'::regclass,'public.usuario'::regclass,'public.estado_carpeta'::regclass] LOOP
    FOR column_name IN SELECT attname FROM pg_attribute WHERE attrelid=target AND attnum>0 AND NOT attisdropped LOOP
      IF target='public."LogAuditoria"'::regclass THEN
        EXECUTE format('REVOKE ALL PRIVILEGES (%I) ON TABLE %s FROM PUBLIC, anon, authenticated',column_name,target);
      ELSIF target='public.usuario'::regclass THEN
        EXECUTE format('REVOKE UPDATE (%I) ON TABLE %s FROM PUBLIC, anon, authenticated',column_name,target);
      ELSE
        EXECUTE format('REVOKE INSERT (%1$I), UPDATE (%1$I), REFERENCES (%1$I) ON TABLE %2$s FROM PUBLIC, anon, authenticated',column_name,target);
      END IF;
    END LOOP;
  END LOOP;
  GRANT UPDATE (nombre, apellido) ON TABLE public.usuario TO authenticated;
  GRANT SELECT, INSERT ON TABLE public."LogAuditoria" TO service_role;
  -- Conservar los flujos internos; no se revoca ningun permiso de service_role.
  GRANT SELECT, UPDATE ON TABLE public.usuario TO service_role;
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.estado_carpeta TO service_role;

  FOREACH target IN ARRAY ARRAY['public."LogAuditoria"'::regclass,'public.estado_carpeta'::regclass] LOOP
    sequence_name := pg_get_serial_sequence(target::text,'id');
    IF sequence_name IS NOT NULL THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON SEQUENCE %s FROM PUBLIC, anon, authenticated',sequence_name);
      EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO service_role',sequence_name);
      FOREACH client IN ARRAY ARRAY['anon','authenticated'] LOOP
        IF has_sequence_privilege(client,sequence_name,'USAGE,SELECT,UPDATE') THEN
          RAISE EXCEPTION 'Permiso heredado indebido en secuencia % para %',sequence_name,client;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  -- Permisos efectivos: detectan tambien concesiones heredadas no exportadas.
  FOREACH client IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF has_table_privilege(client,'public."LogAuditoria"','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR has_any_column_privilege(client,'public."LogAuditoria"','SELECT,INSERT,UPDATE,REFERENCES')
      OR has_table_privilege(client,'public.estado_carpeta','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR has_any_column_privilege(client,'public.estado_carpeta','INSERT,UPDATE,REFERENCES') THEN
      RAISE EXCEPTION 'Permisos indebidos heredados para %; transaccion cancelada',client;
    END IF;
    FOR column_name IN SELECT attname FROM pg_attribute WHERE attrelid='public.usuario'::regclass AND attnum>0 AND NOT attisdropped LOOP
      IF has_column_privilege(client,'public.usuario',column_name,'UPDATE')
        AND NOT (client='authenticated' AND column_name IN ('nombre','apellido')) THEN
        RAISE EXCEPTION 'UPDATE no permitido heredado: %.usuario.%',client,column_name;
      END IF;
    END LOOP;
  END LOOP;
  IF NOT has_column_privilege(current_user,'public.usuario','id_rol','UPDATE')
    OR NOT has_column_privilege(current_user,'public.usuario','id_estado','UPDATE') THEN
    RAISE EXCEPTION 'No se conserva la edicion administrativa del operador';
  END IF;
END;
$security$;
COMMIT;
