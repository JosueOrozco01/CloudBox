# CloudBox — etapa 2 comercial de Fase 7

Estado: implementación y validación locales; aplicación SQL y validación funcional real pendientes del operador. Rama exclusiva `feature/fase8-jenni-notifications-activity-security`, Implementación preparada sobre `0c68495c0246a331f26fe9e1f2dc8c4c4f835ad6`. El usuario autorizó un único commit local de esta etapa con el mensaje `fix: correct phase 7 commercial subscription flows`. Sin nuevas ramas, push, PR ni merges. No se ejecutaron consultas ni escrituras en Supabase.

La referencia remota es el catálogo exportado y verificado, con las tablas `credito_suscripcion`, `evento_credito_suscripcion` y `programacion_suscripcion`, las RPC coincidentes con sus hashes y la función Free modificada manualmente. El renombrado, el cron y los permisos de etapa 1 se consideran aplicados y verificados: no son tareas pendientes. Las migraciones anteriores permanecen intactas.

## Cambios y contratos

| Problema | Corrección |
|---|---|
| Bypass de POST /api/subscriptions/subscribe | La RPC de alta rechaza con 409 una suscripción pagada vigente: mismo plan requiere renovación; otro plan requiere change-plan. También bloquea operaciones programadas, incluso una renovación simulada rechazada. Admite alta desde Free o tras vencimiento. |
| Free | Q0, 1 GB, nombre canónico normalizado y estado activo. API impide modificar sus invariantes o desactivarlo; trigger protege también cambios directos ordinarios. El script aborta si el catálogo real es inconsistente, sin reparar datos a ciegas. No reemplaza la función real de asignación al crear usuarios. |
| Condiciones históricas | Precio, capacidad y vigencia de cualquier plan referenciado por suscripciones quedan inmutables por API y SQL. Otra tarifa usa otro plan mediante el endpoint existente de creación. Descripciones siguen editables y planes no contratados siguen editables. Se preservan precios de origen en renovaciones/créditos futuros sin introducir un libro paralelo. |
| Concurrencia de catálogo | La compra bloquea la tarifa FOR SHARE; un trigger de suscripción hace lo mismo al adquirir/referenciar plan. Una edición concurrente anterior se cobra como la nueva tarifa; una edición posterior a la adquisición se rechaza, sin revalorar el contrato. |
| fecha_fin | Es último día válido completo, en UTC, tanto en consultas como cuotas, métricas y worker. Se exige fecha_inicio <= hoy en las consultas de vigencia. Una alta nueva de N días termina en inicio + N - 1; renovar añade N al vencimiento anterior. No se acortan ni actualizan fechas existentes al instalar. |
| Operaciones diferidas | Cancelación/downgrade nuevos se programan para fecha_fin + 1. Las programaciones antiguas conservan sus fechas almacenadas, pero el worker espera al día siguiente del fin contratado. Un prepago cuyo último día es hoy aún puede activarse; solo está vencido si terminó antes de hoy. |
| Créditos | Se conserva el cálculo decimal y los días completos no consumidos después del día actual. El día en curso no genera crédito fraccional. Se conservan saldos/eventos, no hay pago ficticio Q0 y una referencia usada por un asiento no puede reutilizarse al contratar o renovar. |
| Cuotas | Lectura paginada estable por id de activos y papelera; no omite archivos a partir de max_rows. Actualiza la columna real espacio_usado_by. Tamaños inválidos y catálogos incompletos fallan explícitamente. No se borran archivos al reducir capacidad. |
| Fallback Free | Métricas, resumen, canUserUpload y validateUpload usan la misma cuota virtual del Free real Q0/1GB/activo, incluso sin suscripción persistida. Se conserva suscripcion_vigente=false y fecha null en ese caso. No se inventa id=8; Free ausente produce 503 y no concede capacidad ficticia. |
| Reportes | Stats, ingresos y almacenamiento recorren todas las páginas y no convierten errores en ceros. Ingresos suma centavos de pagos aprobados, sin sumar asientos de crédito. Los filtros DATE usan fechas civiles validadas, no timestamps sobre DATE. |
| Listados administrativos | Usan espacio_usado_by/fecha_fin directamente; filtros de estado se aplican a la FK real, se conservan los totales en páginas vacías y errores de enriquecimiento se propagan. Búsqueda escapa valores de la gramática PostgREST. |

Las firmas RPC y endpoints se mantienen. Se documentan como conflictos comerciales públicos 409: CHANGE_PLAN_REQUIRED, SAME_PLAN_REQUIRES_RENEWAL, PENDING_ACTION_EXISTS y SAME_PRICE_CHANGE_NOT_SUPPORTED. Las condiciones contratadas protegidas usan PLAN_TERMS_IMMUTABLE; Free protegido usa FREE_PLAN_PROTECTED. Se conservan formas de respuestas, identificadores, pagos y datos de historial. `daysRemaining` expresa días completos posteriores a hoy; puede ser 0 durante el último día válido, por lo que la vigencia se decide con las fechas, no con ese contador. Free vigente devuelve null y estados históricos devuelven 0.

## Archivos modificados

- backend/src/services/subscription.service.js: vigencia UTC inclusiva y presentación de historial.
- backend/src/services/subscription-checkout.service.js: errores comerciales del alta.
- backend/src/services/subscription-lifecycle.service.js: conflictos de programación y mismo precio.
- backend/src/services/plan.service.js: invariantes Free, condiciones contratadas y validación de números/vigencia.
- backend/src/services/quota.service.js: paginación, columna real y fallback coherente.
- backend/src/services/admin.service.js: totales, fechas, filtros, paginación y errores.
- backend/scripts/admin-audit.test.js y admin-overview.test.js: carga del helper compartido en los dobles VM.
- backend/scripts/quota-fase7-adjustments.test.js: carga del helper y paginación real del doble, conservando las comprobaciones originales.

## Archivos creados

- backend/src/services/commercial-policy.js: política UTC, Free y lectura paginada compartida; sin servicios nuevos ni dependencias.
- backend/tests/commercial-stage2.test.js: regresiones de fechas, cuota >1000 archivos, servidor con cap de 137 filas, errores/páginas incompletas, filtros, tarifa inmutable y conflictos públicos.
- backend/scripts/test-commercial-stage2.js: integración PostgreSQL temporal con RLS y llamadas service_role, concurrencia, rollback y datos ficticios.
- supabase/manual/commercial/20261027_etapa2.sql: actualización incremental para revisión manual.
- supabase/manual/commercial/20261027_etapa2_rollback.sql: contingencia de definiciones, sin reversión de datos.
- supabase/manual/commercial/20261027_inspeccion.sql: captura de solo lectura antes/después.
- supabase/manual/commercial/20261027_rpc_manifest.json: hashes de cuerpos reales anteriores y nuevos esperados.
- supabase/manual/commercial/README.md: aplicación, precondiciones, reversión y pruebas locales.
- docs/ETAPA2_COMERCIAL_20261027.md: este informe.

Las implementaciones de notificaciones, actividad, auditoría, autenticación y seguridad de carpetas de Fase 8/etapa 1 no se modificaron.

## Validación

Suite completa: **103 pruebas aprobadas, 0 fallidas**, incluidos los 95 casos existentes y ocho grupos nuevos de regresión. Se ejecutaron todos los *.test.js de backend/tests y backend/scripts salvo get-auth-token.test.js, que solicita credenciales reales. HTTP se limita a loopback con Supabase simulado, sin cargar .env.

PostgreSQL 17 aislado: **59 comprobaciones aprobadas**, con RLS activo y llamadas internas service_role: guardas de hashes y catálogo, idempotencia, conservación de filas al instalar, función Free sin cambios, clientes sin EXECUTE, bloqueo del bypass, rechazo transaccional, crédito Q0 sin pago, última fecha, renovación y acciones diferidas. Se prueban dos cambios simultáneos, workers simultáneos, adquisición contra edición de tarifa en ambas direcciones y dos usuarios con una referencia duplicada. El rollback y la reaplicación conservan los registros comerciales generados. No se simula concurrencia mediante sleeps de aplicación: las sesiones reales esperan señales tras adquirir locks; pg_sleep local mantiene la transacción para reproducir la contención.

Las consultas de pruebas sobre histórico local no prueban que esas migraciones deban ejecutarse en remoto. Tampoco certifican Supabase Auth, Storage, exposición PostgREST ni la agenda del cron real.

## Riesgos y pasos de aplicación

1. Revisar y ejecutar manualmente la inspección de solo lectura; guardar definiciones y ACL antes del cambio. No compartir credenciales ni incorporar la captura de negocio a Git.
2. Revisar las condiciones de los planes usados frente al histórico comercial disponible. **Si se editaron tarifas antes de esta protección, las exportaciones de estructura no permiten reconstruir su valor original.** La corrección evita revaloraciones futuras; no inventa una reparación retroactiva ni altera pagos, saldos o fechas para hacer coincidir el catálogo actual. Cualquier discrepancia preexistente requiere revisión de evidencia y un ajuste separado, autorizado.
3. Revisar el script incremental y su manifest. Solo el operador decide su ejecución completa desde SQL Editor. Ante deriva de una RPC, función auxiliar o trigger, el preflight aborta; no quitar guardas ni reejecutar archivos históricos.
4. Coordinar una ventana de endpoints comerciales, aplicar manualmente el SQL y activar conjuntamente esta versión del backend. Guardar inspección posterior: hashes nuevos, Free idéntico, permisos internos y clientes sin EXECUTE.
5. Validar con cuentas de prueba propias los flujos indicados en el README. Observar la ejecución normal del cron existente; no ejecutarlo globalmente como experimento sobre producción. Verificar también filtros y búsquedas mediante PostgREST real y los reportes con un conjunto conocido.

La lectura paginada evita el truncamiento de max_rows, pero no es un snapshot financiero exportable durante escrituras concurrentes. La validación previa a una subida tampoco reserva bytes atómicamente en Storage: ese riesgo previo de subidas simultáneas no queda certificado por las pruebas transaccionales de suscripciones. No se implementó un flujo de archivos nuevo ni se promete exclusión de esa carrera.

No queda ninguna prueba local fallida. La etapa no está desplegada ni certificada funcionalmente en Supabase: faltan revisión/aplicación manual y comprobación real. No avanzar con notificaciones de Fase 8 ni crear commit sin autorización.

## Decisión de despliegue confirmada

El usuario verificó Free Q0/1 GB/36500 días/activo, la consistencia del resto del catálogo y los cinco hashes RPC anteriores. Se esperará hasta disponer del backend comercial actualizado y coordinar su activación antes de aplicar SQL. El commit local no autoriza despliegue ni la etapa 3. No desplegar toda Fase 8 sin delimitar sus funcionalidades aún no adaptadas. La aplicación remota del SQL y la comprobación funcional real siguen pendientes.
