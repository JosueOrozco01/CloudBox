-- SOLO LECTURA. Ejecutar manualmente antes y despues; guardar JSON fuera de Git.
-- No invoca funciones de negocio ni expone identidades/contactos de usuarios.
SELECT jsonb_build_object(
 'timezone',current_setting('TimeZone'),
 'functions',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,
   'hash',md5(replace(p.prosrc,E'\r\n',E'\n')),'definition',pg_get_functiondef(p.oid),
   'acl',p.proacl,'owner',pg_get_userbyid(p.proowner),'config',p.proconfig))
   FROM pg_proc p WHERE pronamespace='public'::regnamespace AND proname IN (
    'cloudbox_subscribe_paid_v1','cloudbox_subscription_renew_v1','cloudbox_subscription_change_v1',
    'cloudbox_subscription_cancel_v1','cloudbox_subscription_expire_v1',
    'cloudbox_subscription_prevent_renew_with_schedule','cloudbox_assign_free_after_user_insert',
    'cloudbox_stage2_guard_plan','cloudbox_stage2_lock_plan')),
 'catalog',(SELECT jsonb_agg(jsonb_build_object('id',p.id,'name',p.nombre,'price',p.precio,
    'gb',p.espacio_maximo_gb,'days',p.vigencia_dias,'state',p.id_estado,
    'referenced',EXISTS(SELECT 1 FROM public.suscripcion s WHERE s.id_plan=p.id))) FROM public.plan p),
 'triggers',(SELECT jsonb_agg(jsonb_build_object('name',tgname,'definition',pg_get_triggerdef(oid)))
    FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN ('public.plan'::regclass,'public.suscripcion'::regclass,'public.usuario'::regclass)),
 'counts',jsonb_build_object('subscriptions',(SELECT count(*) FROM public.suscripcion),
    'payments',(SELECT count(*) FROM public.pago),'credits',(SELECT count(*) FROM public.evento_credito_suscripcion),
    'pending',(SELECT count(*) FROM public.programacion_suscripcion WHERE estado='pending'))
) AS commercial_snapshot;
