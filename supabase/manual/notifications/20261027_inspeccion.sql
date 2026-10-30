-- SOLO LECTURA, compatible antes/despues. Guardar capturas fuera del repositorio.
SELECT jsonb_build_object(
 'table_oid','public.notificacion'::regclass::oid,
 'columns',(SELECT jsonb_agg(jsonb_build_object('name',attname,'type',format_type(atttypid,atttypmod),
    'notnull',attnotnull,'identity',attidentity,'acl',attacl) ORDER BY attnum)
    FROM pg_attribute WHERE attrelid='public.notificacion'::regclass AND attnum>0 AND NOT attisdropped),
 'counts',(SELECT jsonb_build_object('total',count(*),'read',count(*) FILTER(WHERE leida),
    'unread',count(*) FILTER(WHERE NOT leida),'read_without_timestamp',count(*) FILTER(WHERE leida AND to_jsonb(n)->>'fecha_lectura' IS NULL)) FROM public.notificacion n),
 'functions',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'hash',md5(replace(prosrc,E'\r\n',E'\n')),'config',proconfig,'acl',proacl))
    FROM pg_proc p WHERE pronamespace='public'::regnamespace AND (proname IN (
      'cloudbox_assign_free_after_user_insert','cloudbox_subscribe_paid_v1','cloudbox_subscription_renew_v1',
      'cloudbox_subscription_change_v1','cloudbox_subscription_cancel_v1','cloudbox_subscription_expire_v1',
      'cloudbox_notification_create_v1','cloudbox_not_share','cloudbox_not_payment','cloudbox_not_subscription','cloudbox_not_storage'))),
 'triggers',(SELECT jsonb_agg(jsonb_build_object('name',tgname,'definition',pg_get_triggerdef(oid))) FROM pg_trigger
    WHERE NOT tgisinternal AND tgrelid IN ('public.usuario'::regclass,'public.compartir'::regclass,'public.pago'::regclass,'public.suscripcion'::regclass)),
 'acl',(SELECT jsonb_agg(jsonb_build_object('name',oid::regclass::text,'acl',relacl,'rls',relrowsecurity,'force_rls',relforcerowsecurity))
    FROM pg_class WHERE oid IN ('public.notificacion'::regclass,to_regclass('public.cloudbox_notification_event')))
) AS notifications_snapshot;
