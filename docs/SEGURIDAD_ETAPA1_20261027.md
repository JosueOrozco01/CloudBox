# CloudBox — integración protegida y seguridad, etapas 0 y 1

Fecha: 27/10/2026. Rama: `feature/fase8-jenni-notifications-activity-security`.

## Estado de Git y protección

- `origin/develop` actualizado mediante fetch: `5589ffb492ee78b8ccc6b684d1b74bbe699d877b`.
- Se incorporó su contenido inicialmente con `git merge --no-commit --no-ff origin/develop`. Tras autorización expresa, el commit local de integración es `b13c7f3366dc94f1b7662ebe29100a66cfd50f76`, con padres `4a93552121c1c9a41a7c1d724609144f3598b0bf` y `5589ffb492ee78b8ccc6b684d1b74bbe699d877b`. MERGE_HEAD quedó resuelto.
- Único conflicto: `backend/src/app.js`. Se conservaron las importaciones y montajes de notificaciones, actividad, pagos, suscripciones, planes y almacenamiento; el hook de email continúa antes del parser JSON y los errores al final.
- No se modificaron las referencias de develop (`ded05d8`) ni de feature/subscriptions-payments (`33fd47a`). Los dos commits locales fueron autorizados por el usuario; no se hizo push ni PR.
- Respaldo externo verificado: `C:/Users/Rashell.LAPTOP-6GKD1F0N/.codex/visualizations/2026/10/25/01a174c6-3638-7c01-a657-8ca6198cb0bf/seguridad-etapa01-20261027/`. Contiene bundle Git verificable, manifest.json, copia original de los 13 archivos Fase 8, copia de los 17 archivos locales y verification.json con la comprobación posterior y el inventario de archivos integrados.
- Los 17 archivos locales conservan sus SHA-256. Los 13 archivos Fase 8 siguen presentes: diez idénticos en contenido y tres adaptados (`app.js`, `fase8-http.test.js`, `fase8.test.js`). No se añadieron respaldos ni credenciales al índice.

El primer commit contiene 50 archivos de integración: todos idénticos a origin/develop salvo app.js, que conserva las rutas de ambas fases. El segundo commit reúne exclusivamente la seguridad, sus pruebas, documentación y SQL manuales. La corrección de CRLF del test de renombrado y un espacio final de un test recibido de develop van en el segundo commit, sin cambios comerciales. Los respaldos y contratos locales previos quedan fuera de ambos commits.

## Cambios específicos

| Archivo | Cambio |
|---|---|
| backend/src/controllers/admin.controller.js | Los cinco handlers administrativos antiguos delegan errores al middleware existente: evita responder con detalles internos de base de datos. Conserva respuestas exitosas y errores de validación. |
| backend/src/controllers/folder.controller.js | Los siete handlers legacy delegan errores internos al middleware existente; conserva códigos y mensajes públicos 4xx. |
| backend/src/services/folder.service.js | Destino ajeno o inaccesible al mover: 403 EDITOR_PERMISSION_REQUIRED, sin escrituras ni datos internos. |
| backend/tests/security-folders.test.js | Regresión HTTP de movimiento denegado con carpeta intacta; 21 casos de errores internos y cuatro contratos públicos, además de papelera/restauración con RPC simulados. |
| backend/src/controllers/user.controller.js | Valida el tipo de nombre y admite cuerpo ausente como petición inválida; conserva lista permitida nombre/apellido y usuario de la sesión. |
| backend/tests/security-stage1.test.js | Pruebas HTTP con middleware, controladores y servicios reales y Supabase simulado; permisos, aislamiento de perfil, cambios administrativos, auditoría, errores y desactivación legítima. Prueba también el arranque del app.js integrado. |
| backend/scripts/test-security-stage1.js | Integración en PostgreSQL 17 local sin red: permisos efectivos de tablas, columnas y secuencias, RLS, conservación de datos/estructura, acceso administrativo, idempotencia y cancelación por deriva. |
| backend/tests/sql/security-schema.sql | Extracto local de las estructuras y políticas realmente exportadas, con auth.uid y usuarios ficticios exclusivos de pruebas. |
| supabase/manual/security/20261027_inspeccion.sql | Consulta de solo lectura para guardar ACL y permisos efectivos antes/después de una futura ejecución manual. |
| supabase/manual/security/20261027_etapa1.sql | Corrección incremental y transaccional de permisos, preparada para revisión; nunca ejecutada remotamente. |
| supabase/manual/security/README.md | Alcance, orden de revisión manual, reversión basada en ACL capturadas y reproducción de pruebas aisladas. |
| backend/tests/fase8.test.js | Sustituye la caracterización de filtración de errores por la delegación segura y adapta el callback de error. No modifica pruebas funcionales de notificaciones. |
| backend/tests/fase8-http.test.js | Completa el doble administrativo con los handlers que ahora montan las rutas integradas de Fase 7. |
| backend/tests/subscription-table-rename.test.js | Normaliza CRLF en las tres entradas de la comparación, sin cambiar SQL ni reglas comerciales. |
| backend/scripts/quota-fase7-adjustments.test.js | Elimina exclusivamente un espacio en blanco final heredado para git diff --check. |
| backend/src/app.js | Resolución del conflicto de integración descrito arriba. |
| docs/SEGURIDAD_ETAPA1_20261027.md | Este informe. |

Los servicios administrativos, cuotas, pagos y suscripciones tienen exactamente el contenido recibido de origin/develop. Tampoco se cambiaron auth.middleware.js, role.middleware.js, audit.service.js ni activity.service.js respecto del resultado de integrar ambas fases. No se duplicaron servicios ni autorización.

## Contratos y SQL para revisión

- `PATCH /api/users/me`: usa la identidad autenticada, actualiza nombre/apellido y conserva el cliente JWT de la sesión. El SQL permite esas dos columnas a authenticated y mantiene RLS de propietario. id_rol, id_estado y el resto de columnas no son editables directamente por ese cliente.
- `PATCH /api/admin/users/:id/role` y `/status`: siguen exigiendo Administrador y usando el servicio privilegiado existente; auditoría conserva actor, entidad y detalle. No se bloquean los cambios manuales con postgres desde Dashboard/SQL Editor.
- `GET /api/admin/audit-logs`: sigue accesible a Administrador mediante backend. Los clientes anon/authenticated pierden acceso directo a LogAuditoria; service_role conserva lectura e inserción y no se le revocan permisos previos.
- `estado_carpeta`: mantiene lectura del catálogo y operaciones internas; bloquea modificaciones de clientes y protege su secuencia de identidad.
- No se cambian tablas, registros, políticas de propietario, funciones RPC, triggers, propietarios ni RLS forzado. No se ejecutan migraciones históricas ni se reinician secuencias. El SQL aborta si aparecen permisos heredados incompatibles o una política UPDATE distinta de la exportada.

La corrección de permisos está **aplicada y verificada en Supabase**, según confirmación del usuario tras ejecutar manualmente el SQL y comprobar los permisos posteriores. No volver a ejecutarlo. Esta confirmación se acepta como evidencia operativa; no se atribuye a una conexión directa de este chat. No hay una migración histórica declarada pendiente por existir en el repositorio.

## Validación inicial (antes de la comprobación funcional posterior)

- Suite Node local: **92 pruebas aprobadas, 0 fallidas**. Todos los archivos `*.test.js` de backend/tests y backend/scripts salvo `get-auth-token.test.js`, que requiere credenciales reales. Incluye pruebas unitarias, HTTP y regresión de ambas fases; Supabase está simulado y no se carga .env.
- SQL: `node backend/scripts/test-security-stage1.js`, 53 comprobaciones satisfactorias en PostgreSQL 17 con `--network none`, sin puertos ni bind mounts. Incluye intentos directos de modificar rol/estado, cambios mixtos bloqueados atómicamente, edición propia permitida, edición ajena excluida por RLS, lectura de catálogo, auditoría interna y edición administrativa con postgres/service_role. Aplicar dos veces conserva ACL; una concesión heredada inesperada cancela la transacción sin cambios parciales.
- Frontend: `npm run build` satisfactorio, 1975 módulos. No se cambió código frontend.
- Git: sin conflictos restantes; comprobación de espacios en working tree e índice; referencias protegidas y SHA-256 de archivos locales verificados.

Las advertencias de Promise-like provienen del uso de módulos VM en los dobles de pruebas, sin afectar los resultados. Los mensajes de error simulados se registran en el servidor; las respuestas HTTP no contienen sus detalles internos.

## Límites y siguientes etapas

Esta entrega cubre la integración local protegida y la implementación/prueba local de seguridad. El usuario ya aplicó y verificó los permisos en Supabase. Falta completar la validación funcional real con cuentas de prueba: ver VALIDACION_FUNCIONAL_ETAPA1_20261027.md. Las pruebas locales no certifican las credenciales reales, JWT, membresías no exportadas ni el comportamiento real de los RPC de carpetas; estos últimos no se modifican.

Se conserva como correcto el renombrado de las tres tablas comerciales, sus RPC verificados y la ejecución posterior del cron. No se reinstala la versión histórica del trigger Free ni se la declara pendiente.

Quedan fuera, expresamente: bypass de subscribe, reglas Free, créditos históricos, límites de fecha_fin, cuotas/reportes y adaptación de notificaciones a la tabla real. Tampoco se declaran integrados productores externos de eventos. Las pruebas actuales de notificaciones usan dobles y no certifican compatibilidad con su esquema remoto; esa revisión corresponde a la etapa posterior. No se afirma que Fase 7/Fase 8 estén completadas globalmente.

El usuario autorizó los dos commits locales y únicamente las dos correcciones adicionales de carpetas. No continuar con correcciones comerciales ni notificaciones; no hacer push, PR ni merge hacia develop.

## Actualización funcional posterior

Permisos remotos aplicados y verificados por el usuario. La suite funcional posterior pasó 93 pruebas (0 fallidas), con rutas reales de perfil/desactivación y cobertura adicional de carpetas. No se volvió a ejecutar SQL. El cierre funcional remoto se documenta en VALIDACION_FUNCIONAL_ETAPA1_20261027.md. Los dos hallazgos de carpetas se corrigieron posteriormente por autorización expresa.

## Correcciones finales autorizadas y commits locales

Las 25 pruebas afectadas y la suite general de 95 pruebas pasan sin fallos. Mover a un destino ajeno responde 403 sin cambiar la carpeta; los errores internos de los siete handlers legacy ya no exponen error.message. Los códigos y mensajes públicos de validación se conservan. No se ejecutó SQL adicional, ni local ni remoto. El SQL manual aprobado permanece idéntico al ya aplicado en Supabase. Se respaldaron previamente 62 archivos, el índice y ambos parches en pre-commits-seguridad-20261027, fuera del repositorio. Las auditorías de los dos índices se guardan allí. El primer commit se verificó contra origin/develop y el segundo contra una lista explícita de archivos de seguridad.
