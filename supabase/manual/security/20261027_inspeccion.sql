-- SOLO LECTURA. Guardar el resultado ANTES y DESPUES de aplicar etapa1.sql.
-- Incluye ACL originales (tabla, columna y secuencia) para revision/reversion manual.
WITH targets AS (
  SELECT oid FROM pg_class WHERE oid IN ('public."LogAuditoria"'::regclass,
    'public.usuario'::regclass,'public.estado_carpeta'::regclass)
), objects AS (
  SELECT oid FROM targets UNION
  SELECT pg_get_serial_sequence(oid::regclass::text,'id')::regclass::oid FROM targets
)
SELECT jsonb_build_object(
  'operator',current_user,
  'objects',(SELECT jsonb_agg(jsonb_build_object('name',c.oid::regclass::text,
    'owner',pg_get_userbyid(c.relowner),'acl',c.relacl,'rls',c.relrowsecurity,
    'force_rls',c.relforcerowsecurity)) FROM pg_class c JOIN objects o USING(oid)),
  'columns',(SELECT jsonb_agg(jsonb_build_object('table',attrelid::regclass::text,
    'column',attname,'acl',attacl)) FROM pg_attribute WHERE attrelid IN (SELECT oid FROM targets)
    AND attnum>0 AND NOT attisdropped),
  'policies',(SELECT jsonb_agg(to_jsonb(p)) FROM pg_policies p WHERE schemaname='public'
    AND tablename IN ('LogAuditoria','usuario','estado_carpeta')),
  'roles',(SELECT jsonb_agg(jsonb_build_object('role',rolname,'superuser',rolsuper,
    'bypass_rls',rolbypassrls,'inherit',rolinherit)) FROM pg_roles
    WHERE rolname IN ('anon','authenticated','service_role','postgres')),
  'effective',(SELECT jsonb_agg(jsonb_build_object('role',r,
    'schema_usage',has_schema_privilege(r,'public','USAGE'),
    'audit_read',has_table_privilege(r,'public."LogAuditoria"','SELECT'),
    'audit_insert',has_table_privilege(r,'public."LogAuditoria"','INSERT'),
    'role_update',has_column_privilege(r,'public.usuario','id_rol','UPDATE'),
    'status_update',has_column_privilege(r,'public.usuario','id_estado','UPDATE'),
    'name_update',has_column_privilege(r,'public.usuario','nombre','UPDATE'),
    'folder_status_read',has_table_privilege(r,'public.estado_carpeta','SELECT'),
    'folder_status_write',has_table_privilege(r,'public.estado_carpeta','INSERT,UPDATE,DELETE,TRUNCATE')))
    FROM unnest(ARRAY['anon','authenticated','service_role','postgres']) r)
) AS security_snapshot;
