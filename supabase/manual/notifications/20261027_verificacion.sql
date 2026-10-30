-- SOLO LECTURA DESPUES de aplicar etapa3.sql. No invoca productores ni RPC comerciales.
SELECT r AS role,
 has_table_privilege(r,'public.notificacion','SELECT') AS notification_select,
 has_table_privilege(r,'public.notificacion','UPDATE') AS notification_update,
 has_table_privilege(r,'public.cloudbox_notification_event','SELECT') AS ledger_select,
 has_function_privilege(r,'public.cloudbox_notification_create_v1(integer,text,text,text,text,integer,text)','EXECUTE') AS can_emit,
 has_column_privilege(r,'public.usuario','id_rol','UPDATE') AS role_update,
 has_column_privilege(r,'public.usuario','id_estado','UPDATE') AS status_update,
 has_column_privilege(r,'public.usuario','nombre','UPDATE') AS name_update
FROM unnest(ARRAY['anon','authenticated','service_role','postgres']) r;
SELECT tgname,tgenabled,pg_get_triggerdef(oid) AS definition FROM pg_trigger
 WHERE NOT tgisinternal AND tgname IN ('cloudbox_not_share','cloudbox_not_payment','cloudbox_not_subscription','cloudbox_not_storage');
SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public'
 AND tablename IN ('notificacion','cloudbox_notification_event');
