# Fase 8 Jennifer — implementación e integración

Rama: `feature/fase8-jenni-notifications-activity-security`.
Base común con develop: `ded05d8ccbbeb31c4b55e92fa7f2b1989d4237f8`.
Referencia principal: `CLOUDBOX_FASE8_CONTRATO_JENNIFER.md`.

## Auditoría inicial
Monolito CommonJS con rutas/controladores/servicios, Express 5 y Supabase. Las pruebas existentes usan node:test y VM con dobles. No había módulo de notificaciones. Se reutilizan requireAuth, authorizeRole, activity.service y audit.service sin duplicarlos. La bitácora administrativa ya existe en GET /api/admin/audit-logs con autorización Administrador. No se modifica su servicio ni cuotas/reportes. Se preservan respaldos y archivos locales.

## API y contratos
- GET /api/notifications y /api/notifications/unread: `{success:true,data:[],pagination:{limit,offset}}`.
- PATCH /api/notifications/:id/read: `{success:true,data:notification}`. Repetir conserva fecha original.
- PATCH /api/notifications/read-all: `{success:true,data:{updatedCount}}`, solo cambia pendientes.
- DELETE /api/notifications/:id: 204 sin cuerpo; ausente, eliminado o ajeno: 404.
- No hay POST público. Toda consulta/mutación usa req.user.id, nunca userId del cliente.
- limit: entero 1–100, defecto 20; offset: entero >=0, defecto 0. Entradas inválidas: 400.
- GET /api/activity conserva `{success:true,data:[]}`; añade from/to ISO YYYY-MM-DD inclusivos en UTC y action por nombre exacto. Orden fecha DESC, id DESC. Errores internos pasan al manejador existente y no exponen detalles.
- NOT-01 createNotification conserva firma existente prevista; extensión opcional `deduplicationKey` (máximo 200) permite deduplicar por receptor/tipo/transición. Retorna null si ya existe. Errores de persistencia se propagan; `notifyAfterCommit(event)` es el adaptador opcional tolerante a fallos, sin cambiar NOT-01.
- Los siete tipos del contrato están disponibles. Los productores reales externos NO están conectados aún; tests invocan NOT-01 con dobles, no afirman integración comercial verificada.

## Puntos exactos para integrar
Tras confirmar la operación, llamar notifyAfterCommit con receptor, tipo, título y mensaje aprobados; sin tokens, contraseñas ni URLs firmadas. No pasar payloads completos de terceros como mensaje.
- ShareService.shareFile/shareFolder: después de insertar compartir; receptor del recurso. Tipos FILE_SHARED/FOLDER_SHARED.
- ShareService.revokeShare: después de confirmar revocación; ACCESS_REVOKED al receptor anterior.
- Fase 7: después de confirmar pago aprobado y activar suscripción; PAYMENT_APPROVED/SUBSCRIPTION_ACTIVATED. No importar servicios de suscripción ausentes.
- Cron de vencimiento: SUBSCRIPTION_EXPIRING, clave `subscription:<id>:expires:<fecha>:<umbral>`.
- Control de almacenamiento: STORAGE_NEAR_LIMIT, clave `storage:<usuario>:<periodo>:<umbral>:<transicion>`. No usar hora de ejecución como clave. Una nueva transición necesita una nueva clave.
- Benja conserva AUD-01 recordLog después de confirmar activar/desactivar usuario, roles y planes. Cancelaciones y revocaciones usarán contrato existente al integrarse, sin duplicar el middleware client-activity. No copiar eventos a actividad y LogAuditoria por defecto.

## Migración
`supabase/migrations/20261025040000_fase8_notifications.sql`: tabla notificacion, FK usuario con cascada, restricciones, índices de historial y deduplicación. RLS habilitada; anon/authenticated sin acceso directo, operaciones solo desde backend service_role con filtro obligatorio de propietario. Sin triggers/email. Ejecutar primero en PostgreSQL/Supabase local o staging aislado. No se ha ejecutado contra producción. SQL y rollback validados en PostgreSQL 17 temporal con esquema mínimo ficticio; el esquema integrado completo sigue pendiente.
Rollback de esta migración únicamente, antes de contener datos que deban conservarse: `BEGIN; DROP TABLE public.notificacion; COMMIT;`. Requiere respaldo si ya hay avisos; elimina índices y secuencia asociada.

## Seguridad y hallazgo para Benja
SEC-01 probado con middleware real y Supabase doble: 401, token inválido, inactivo 403, rol insuficiente 403, propietario/tercero, 404 privado, errores internos genéricos de endpoints propios.
Hallazgo reproducible preexistente: admin.controller.getOverview y otros catch responden error.message en 500. Prueba `SEC finding` en backend/tests/fase8.test.js usa INTERNAL_SENTINEL y confirma exposición sin secretos reales. Benja debe delegar al manejador global o devolver mensaje genérico en 500. No se modificaron archivos administrativos. La prueba caracteriza el defecto, no certifica que esté corregido.

## Archivos
Nuevos: history-validation.js, notification.service.js, notification.controller.js, notification.routes.js; backend/tests/helpers.js, fase8.test.js, fase8-http.test.js; migración y este informe.
Modificados: activity.service.js, activity.controller.js, app.js (montaje mínimo de ruta), scripts/share-access.test.js (doble corregido a lista, como devuelve Supabase).
El montaje en app.js queda identificado como punto compartido para revisión de integración; no añade dependencia en Fase 7.

## Verificación
Pruebas nuevas: `node --test backend/tests/fase8*.test.js`. HTTP requiere permiso para loopback fuera del sandbox; Supabase siempre sustituido por dobles. Las pruebas no leen .env.
Suite amplia local: todos backend/scripts/*.test.js salvo get-auth-token.test.js, más backend/tests/fase8*.test.js. get-auth-token es un script manual que necesita credenciales y no pertenece a la suite aislada; no se suministraron credenciales ni se ejecutaron operaciones remotas.
Ejecución inicial amplia: 45/48; fallos por loopback bloqueado, script sin credenciales y doble antiguo de share-access. Loopback repetido con permiso; doble corregido sin modificar servicios de archivos. Resultado final registrado al terminar.

Pendiente antes de certificar integración completa: integrar productores Fase 7/Benja, ejecutar migración sobre el esquema integrado aislado y smoke/E2E conjunto; corregir hallazgo administrativo por Benja. Sin merge, push ni cambios de rama.

### Resultado final local
Suite de regresión aislada (sin script manual de credenciales): 49/49 aprobadas. Suite Fase 8 incluyendo HTTP con permiso loopback: 9/9 aprobadas. Sin fallos en estas suites. La prueba de hallazgo administrativo pasa al reproducir el defecto pendiente; no implica remediación. No se certifica cierre integral de seguridad ni despliegue hasta corrección por Benja y validación sobre el esquema integrado aislado.

### Validación SQL adicional
Ejecutada exitosamente en PostgreSQL 17 temporal de Docker, sin red ni volúmenes, con roles y usuario ficticios: creación de tabla/índices/FK/restricciones, inserción mínima, RLS habilitada, SELECT denegado a authenticated y rollback DROP TABLE confirmado. Esta validación reemplaza la limitación inicial de motor no disponible; no verifica el esquema completo desplegado ni sustituye el smoke de integración.

## Auditoría final previa al commit — 25/10/2026

### Base, alcance y archivos revisados
Rama verificada: feature/fase8-jenni-notifications-activity-security. HEAD coincide con ded05d8ccbbeb31c4b55e92fa7f2b1989d4237f8. No hay commits posteriores a esa base ni archivos staged. Se revisó el diff completo de archivos versionados y el contenido completo de los nuevos archivos propuestos: git diff no incluye por sí solo archivos sin seguimiento.

Manifiesto de 13 archivos propios para revisión del futuro commit:

| Archivo | Estado respecto a base | Justificación |
|---|---|---|
| backend/src/app.js | Modificado | Import y montaje de notification.routes siguiendo el estilo existente; coordinar archivo compartido en integración. |
| backend/src/services/activity.service.js | Modificado | Filtros y paginación estricta, orden estable; registro existente intacto. Sin action conserva relación opcional; con action utiliza inner join. |
| backend/src/controllers/activity.controller.js | Modificado | Transfiere filtros y delega errores al manejador global, manteniendo respuesta exitosa. |
| backend/scripts/share-access.test.js | Modificado | Dos dobles pasan de objeto a lista, como la consulta real. Corrige falso fallo y falso positivo del test de permiso editor. No modifica share.service. |
| backend/src/services/history-validation.js | Nuevo | Validación compartida exclusivamente por actividad y notificaciones. |
| backend/src/services/notification.service.js | Nuevo | NOT-01, operaciones por receptor, deduplicación y adaptador posterior a commit. |
| backend/src/controllers/notification.controller.js | Nuevo | Contrato HTTP y errores delegados. |
| backend/src/routes/notification.routes.js | Nuevo | Cinco rutas protegidas con requireAuth existente, sin creación pública. |
| backend/tests/helpers.js | Nuevo | Dobles locales de consultas y carga aislada de módulos. |
| backend/tests/fase8.test.js | Nuevo | Contratos NOT/AUD, propietarios, filtros, errores y reproducción del hallazgo administrativo. |
| backend/tests/fase8-http.test.js | Nuevo | HTTP con rutas reales de notificaciones, actividad y administración; auth/roles reales sobre dobles. |
| supabase/migrations/20261025040000_fase8_notifications.sql | Nuevo | Tabla e índices propios; no cambia tablas administrativas, comerciales ni migraciones anteriores. |
| docs/CLOUDBOX_FASE8_JENNIFER_IMPLEMENTACION.md | Nuevo | API, integración, migración, resultados y esta auditoría. |

Sin diferencias frente a la base en admin.service, admin.controller, admin.routes, quota.service, audit.service, middlewares, package.json, lockfile ni migraciones previas. No se añadieron módulos de pagos o suscripciones.

### Correcciones de esta auditoría
- markAllRead usa update con count exact, sin devolver IDs; updatedCount deja de depender del máximo de filas representadas por PostgREST. Prueba con 1501 pendientes, usuario tercero y repetición con cero cambios. La opción fue contrastada con el código del SDK instalado.
- app.js usa import al inicio, como el resto de las rutas.
- Pruebas HTTP ahora montan las rutas reales de actividad y administración; cubren 401/403, filtros inválidos, aislamiento y errores internos. Los controladores administrativos se sustituyen para no acceder a almacenamiento real.
- Se aclaró el nombre de la prueba de siete tipos: aceptar eventos NOT-01 no significa que los productores externos estén implementados/conectados.
- Se eliminaron afirmaciones documentales desactualizadas sobre la validación SQL ya realizada.

### Cobertura del contrato y pendientes

| Área | Verificado localmente | Pendiente real |
|---|---|---|
| NOT: servicio, listados, lectura, lectura masiva, eliminación, aislamiento | Implementado y probado, incluida paginación y orden | Validación con PostgREST/Supabase sobre esquema integrado. |
| NOT: compartir archivo/carpeta, revocar acceso, pago aprobado, activación, vencimiento y límite | Los siete tipos se aceptan y persisten con dobles; adaptador tolera fallo y deduplica transiciones | Los siete productores de negocio NO están conectados. Cron y detección de transiciones tampoco se implementaron: integración posterior prevista por contrato. |
| ACT: historial, fechas, tipo, paginación y propiedad | Implementado y probado; sin convertir ruta propia en global | Smoke con datos integrados. |
| ACT: activación/desactivación y roles | Contrato AUD-01 y orden posterior a éxito probado con controlador existente/dobles | Cobertura conjunta de cada operación al integrar. |
| ACT: cambios administrativos de planes, cancelación y revocación | recordLog acepta los eventos de contrato; middleware existente evita duplicación en pruebas | Los productores externos deben llamar AUD-01 después de confirmar, una sola vez; no se afirma conexión ni ejecución real. |
| SEC: autenticación, inactivo, roles, propietario/tercero, errores propios | Middleware reutilizado, pruebas 401/403/404/400 y respuestas 500 genéricas | Hallazgo administrativo de Benja pendiente; pruebas con Auth/RLS reales en entorno aislado. |

La clave opcional deduplicationKey conserva compatibilidad con la firma mínima NOT-01; debe ser estable por transición/recurso. Un fallo de notificación devuelve null en notifyAfterCommit y no revierte el negocio; el adaptador no ofrece reintentos ni garantía de entrega, fuera del alcance.

### Pruebas y comprobaciones finales
- Suite local explícita de 11 archivos (dos Fase 8 y nueve scripts de regresión): 52/52 aprobadas, cero fallos, cero omitidas. Incluye admin-audit, admin-overview, admin-permissions, client-activity, dashboard, favorite-access, session-history, settings y share-access.
- get-auth-token.test.js excluido deliberadamente: script manual con credenciales reales, no suite aislada. No se leyó .env ni se accedió a Supabase de producción.
- node --check de todos los JavaScript del manifiesto: aprobado.
- git diff --check y git diff BASE --check: sin errores; Git solo avisa conversión LF/CRLF en Windows.
- Revisión de firmas de JWT, claves privadas, claves de proveedor y asignaciones literales sensibles en los 13 candidatos: sin coincidencias. Referencias process.env son configuración, no credenciales. Esto es una inspección acotada a los archivos de entrega, no un escaneo del historial ni de respaldos ajenos.
- La migración sigue idéntica a la validada previamente con PostgreSQL 17 temporal sin red; es nueva e incremental. Rollback documentado y probado; destruye únicamente la tabla propia y sus datos. No se reaplicaron migraciones antiguas.
- Express emite advertencia en pruebas por Promises de módulos cargados en VM (otro contexto); la suite pasa. No demuestra una advertencia en el arranque real.

### Archivos locales excluidos del manifiesto
Conservados sin modificar ni preparar: .payment-module-backup/, .subscription-03-backups/, backend/src/app.js.subscription-backup, cloudbox_concurrencia/, cloudbox_local_final/, supabase/migrations/*.pre-sync-backup y *.pre-concurrency-review-backup. Tampoco se modificaron ni se incorporaron automáticamente los dos contratos locales sin seguimiento en docs. Evitar un git add global al preparar el futuro commit: revisar el manifiesto explícito. La auditoría no hizo staging ni commit.

### Riesgos para integrar
Benja debe corregir la exposición de error.message en respuestas administrativas 500, usando el manejador global o mensaje genérico; la prueba de caracterización pasa al reproducir el defecto, no certifica seguridad corregida. Coordinar montaje app.js y extensión opcional NOT-01. Validar RLS/permisos service_role, relación actividad/accion y migración en el esquema completo integrado; la prueba SQL previa usó usuario mínimo ficticio. Ningún productor externo se declara completado. Sin commit, push, merge ni cambio de rama.
- Smoke adicional de arranque real: require de backend/src/app completado con placeholders locales y fetch deshabilitado, sin imports rotos ni módulos de Fase 7. No se abrió puerto ni se hicieron llamadas externas.
