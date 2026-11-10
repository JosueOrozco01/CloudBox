-- Read-only checks for the current CloudBox schema. Does not apply migrations.
-- Run in the SQL editor of the intended Supabase project, before deployment.

-- 1. Physical names and expected additions.
SELECT name, to_regclass(name) AS relation
FROM (VALUES ('public."LogAuditoria"'),('public.usuario'),('public.archivo'),
  ('public.notificacion_administrador'),('public.solicitud_soporte'),
  ('public.mensaje_soporte'),('public.limpieza_almacenamiento'),
  -- Nombres anteriores: se renombran al instalar la migración actual.
  ('public.admin_notification_read'),('public.support_ticket'),
  ('public.support_message'),('public.cloudbox_storage_cleanup')) AS objects(name);

SELECT table_name,column_name,data_type,is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND (
  (table_name='archivo' AND column_name IN ('tamano_bytes','ruta_storage','storage_deleted_at'))
  OR (table_name='usuario' AND column_name IN ('auth_user_id','espacio_usado_by')))
ORDER BY table_name,ordinal_position;

-- 2. Catalog IDs used by the existing application and the quota guards.
SELECT 'estado_archivo' AS catalog,id,nombre FROM public.estado_archivo
UNION ALL SELECT 'estado_carpeta',id,nombre FROM public.estado_carpeta
UNION ALL SELECT 'estado_plan',id,nombre FROM public.estado_plan
UNION ALL SELECT 'estado_suscripcion',id,nombre FROM public.estado_suscripcion
ORDER BY catalog,id;

SELECT id,nombre,precio,espacio_maximo_gb,vigencia_dias,id_estado
FROM public.plan WHERE lower(btrim(nombre))='free';

-- 3. Aggregate integrity checks. No personal records or storage paths are shown.
SELECT 'active_folder_duplicate_groups' AS check_name,count(*) AS issues
FROM (SELECT id_usuario,id_padre,nombre FROM public.carpeta WHERE id_estado=1
  GROUP BY id_usuario,id_padre,nombre HAVING count(*)>1) AS duplicates
UNION ALL
SELECT 'active_folder_unavailable_parent',count(*) FROM public.carpeta c
  LEFT JOIN public.carpeta p ON p.id=c.id_padre
  WHERE c.id_estado=1 AND c.id_padre IS NOT NULL
    AND (p.id IS NULL OR p.id_estado<>1 OR p.id_usuario<>c.id_usuario)
UNION ALL
SELECT 'active_file_name_duplicate_groups',count(*)
FROM (SELECT id_usuario,id_carpeta,lower(nombre) FROM public.archivo WHERE id_estado=1
  GROUP BY id_usuario,id_carpeta,lower(nombre) HAVING count(*)>1) AS duplicates
UNION ALL
SELECT 'shared_storage_path_groups',count(*)
FROM (SELECT ruta_storage FROM public.archivo GROUP BY ruta_storage HAVING count(*)>1) AS duplicates
UNION ALL
SELECT 'shares_without_exactly_one_resource',count(*) FROM public.compartir
  WHERE (id_archivo IS NULL)=(id_carpeta IS NULL)
UNION ALL
SELECT 'duplicate_favorite_groups',count(*)
FROM (SELECT id_usuario,id_archivo FROM public.favorito
  GROUP BY id_usuario,id_archivo HAVING count(*)>1) AS duplicates
UNION ALL
SELECT 'multiple_current_subscription_users',count(*)
FROM (SELECT s.id_usuario FROM public.suscripcion s
  JOIN public.estado_suscripcion e ON e.id=s.id_estado
  WHERE e.nombre IN ('Activa','PorVencer')
    AND s.fecha_inicio<=(now() AT TIME ZONE 'UTC')::date
    AND s.fecha_fin>=(now() AT TIME ZONE 'UTC')::date
  GROUP BY s.id_usuario HAVING count(*)>1) AS duplicates;

WITH RECURSIVE chain AS (
  SELECT id AS root,id,id_padre,ARRAY[id] AS visited,false AS cycle FROM public.carpeta
  UNION ALL
  SELECT c.root,p.id,p.id_padre,c.visited||p.id,p.id=ANY(c.visited)
    FROM chain c JOIN public.carpeta p ON p.id=c.id_padre WHERE NOT c.cycle
)
SELECT 'folders_with_cyclic_ancestry' AS check_name,count(DISTINCT root) AS issues
FROM chain WHERE cycle;

-- This count is expected to be nonzero when historical logical deletions exist.
-- It is not proof that the corresponding Storage objects still exist.
SELECT count(*) AS deleted_rows_requiring_physical_confirmation
FROM public.archivo WHERE id_estado=3;

-- 4. The context export does not list all indexes, policies or trigger bodies.
SELECT tablename,indexname,indexdef FROM pg_indexes
WHERE schemaname='public' AND tablename IN ('archivo','carpeta','favorito','compartir')
ORDER BY tablename,indexname;

SELECT conrelid::regclass AS relation,conname,pg_get_constraintdef(oid) AS definition
FROM pg_constraint WHERE conrelid IN ('public.archivo'::regclass,'public.carpeta'::regclass,
  'public.favorito'::regclass,'public.compartir'::regclass)
ORDER BY conrelid::regclass::text,conname;

SELECT c.relname AS relation,t.tgname,t.tgenabled,p.oid::regprocedure AS handler
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid
WHERE n.nspname='public' AND NOT t.tgisinternal
ORDER BY c.relname,t.tgname;

SELECT tablename,policyname,roles,cmd FROM pg_policies
WHERE schemaname='public' ORDER BY tablename,policyname;

SELECT p.oid::regprocedure AS function_name
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND (p.proname LIKE 'cloudbox_%'
  OR p.proname IN ('eliminar_carpeta_cascada','restaurar_carpeta_cascada'))
ORDER BY p.oid::regprocedure::text;
