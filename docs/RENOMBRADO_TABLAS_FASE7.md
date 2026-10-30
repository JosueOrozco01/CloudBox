# Fase 7 — Renombrado de tablas: informe para revisión

Fecha: 25/10/2026. Rama exclusiva: `feature/subscriptions-payments`. Sin commit, push, merge, rebase, cherry-pick ni cambio de rama. Sin conexiones a Supabase ni credenciales reales.

## Auditoría inicial e inventario

El árbol inicial tenía el contrato de Jennifer Fase 8 preparado en el índice, respaldos locales y una candidata `20261025050000_renombrar_tablas_suscripcion.sql` sin seguimiento. Todo lo ajeno se conserva. No se modifican archivos de implementación de Fase 8, servicios administrativos, cuotas, pagos ni suscripciones. El backend ya utiliza RPC; no necesita cambios de consultas para esta corrección.

| Referencia encontrada | Tratamiento |
|---|---|
| `supabase/migrations/20261025030000_subscription_policy_v2.sql` | Crea las tres tablas, dos secuencias identity, índices, ACL y cuatro funciones con referencias textuales. Histórica: intacta. |
| `supabase/migrations/20261025050000_renombrar_tablas_suscripcion.sql` | Candidata comparada con las definiciones actuales; las cuatro funciones coincidían exactamente tras sustituir identificadores. Endurecida y preparada para revisión, no aplicada a Supabase. |
| `backend/tests/subscription-policy-v2.test.js` | Actualizadas expectativas de nombres finales; mantiene comprobaciones históricas de índices y permisos. |
| `docs/SUSCRIPCIONES_DECISIONES_TECNICAS.md` | Cuatro referencias cambiadas a los nombres finales en español. |
| `cloudbox_local_final/03_pruebas.sql`, `cloudbox_concurrencia/CONCURRENCIA.ps1` | Pruebas locales anteriores con nombres viejos. Conservadas sin editar; no son la prueba de esta entrega. Ejecutarlas sobre una BD renombrada requeriría adaptación posterior. |
| `supabase/migrations/20261025030000_subscription_policy_v2.sql.pre-concurrency-review-backup` | Respaldo histórico conservado. No forma parte de la migración ni del futuro commit. |
| Backend, frontend, controladores, rutas y funciones Supabase | Sin referencias a los tres nombres viejos. `.rpc()` conserva las firmas existentes. |
| Nuevas pruebas, fixture y rollback | Contienen nombres viejos deliberadamente para crear el estado anterior, verificar ausencia después y restaurar nomenclatura. No son consultas de producción posteriores al cambio. |

Mapeo:

| Anterior | Final |
|---|---|
| cloudbox_subscription_credit | credito_suscripcion |
| cloudbox_subscription_credit_event | evento_credito_suscripcion |
| cloudbox_subscription_schedule | programacion_suscripcion |

No se encontraron conflictos con esos destinos en el repositorio ni en el esquema que proporcionó el usuario. No se ha inspeccionado el catálogo de producción; la migración vuelve a comprobar los tres destinos antes de cambiar nada, incluyendo conflictos con vistas/secuencias.

## Migración y dependencias SQL

La versión 20261025050000 es única en esta rama y posterior a 20261025030000. Se conservan todas las migraciones históricas. La candidata actualizada:

1. Abre una transacción y limita a 10 segundos la espera de locks.
2. Exige tres tablas origen y tres destinos libres.
3. Comprueba firmas y hashes de los cuerpos actuales contra la política v2 revisada (normaliza CRLF). Aborta ante diferencias, incluso de comentarios/formato: no sobrescribe versiones distintas de las revisadas.
4. Busca referencias textuales en **todas** las funciones de esquemas no internos, no solo las cuatro conocidas; aborta si aparece una adicional. También cubre SQL dinámico cuyo texto contenga los identificadores completos.
5. Renombra con ALTER TABLE ... RENAME TO y sustituye únicamente los tres identificadores en los cuatro cuerpos afectados.
6. Verifica que no queden referencias textuales antiguas en funciones antes de COMMIT.

Funciones actualizadas, conservando firma, retorno, nombres públicos, SECURITY DEFINER cuando corresponde y search_path:

- `cloudbox_subscription_change_v1(integer,integer,integer,text,boolean)`.
- `cloudbox_subscription_cancel_v1(integer)`.
- `cloudbox_subscription_prevent_renew_with_schedule()` — función del trigger de renovación.
- `cloudbox_subscription_expire_v1()` — incluye `%ROWTYPE` y worker.

Checkout y renovación no contienen esos nombres y no se reemplazan. El trigger existente conserva OID y enlace a su función. No se recrean tablas, índices, políticas ni triggers. PostgreSQL mantiene por OID las dependencias de FK, vistas y expresiones de políticas. Sus nombres internos en inglés y las secuencias identity se conservan deliberadamente: renombrarlos ampliaría el alcance y puede romper consumidores de nombres internos. El registro de datos y la lógica comercial permanecen iguales.

Los identificadores construidos por concatenación fragmentada, SQL almacenado en datos o consumidores fuera del repositorio no se pueden descartar mediante búsqueda textual; se revisan como precondición de despliegue, no se actualizan automáticamente.

## Archivos de esta entrega

| Archivo | Razón |
|---|---|
| `supabase/migrations/20261025050000_renombrar_tablas_suscripcion.sql` | Renombrado incremental y cuatro funciones, con preflight y transacción. |
| `supabase/rollbacks/20261025050000_renombrar_tablas_suscripcion.sql` | Reversión manual transaccional sin pérdida de filas. Fuera del directorio autoaplicado. |
| `backend/tests/subscription-policy-v2.test.js` | Expectativas sobre la nomenclatura final. |
| `backend/tests/subscription-table-rename.test.js` | Verifica sustitución exacta sin cambios de negocio, rollback y ausencia de referencias runtime. |
| `backend/tests/sql/subscription-schema.sql` | Adaptación local del esquema completo public suministrado por el usuario, sin datos reales. |
| `backend/scripts/test-subscription-table-rename.js` | Prueba PostgreSQL reproducible de integridad, RPC, concurrencia y reversión. |
| `docs/SUSCRIPCIONES_DECISIONES_TECNICAS.md` | Nombres finales en documentación funcional. |
| `docs/RENOMBRADO_TABLAS_FASE7.md` | Este informe, despliegue, límites y resultados. |

No se hizo staging. El contrato Fase 8 que ya estaba staged no pertenece a este cambio y sigue sin alterarse. No usar git add global para el futuro commit; revisar explícitamente estos ocho archivos.

## Entorno y alcance real de las pruebas

PostgreSQL 17 en contenedor `cloudbox-rename-validation`, `--network none`, sin puertos ni bind mounts. La imagen crea un volumen anónimo temporal, eliminado al detener el contenedor con `--rm`. El runner valida imagen, aislamiento y tipo de volumen antes de ejecutar SQL; crea bases de datos nuevas con nombres de prueba por ejecución. No lee .env.

El fixture reproduce las tablas public del esquema proporcionado, no la base simplificada `01_base_ficticia.sql`. Adaptaciones explícitas del esquema de contexto: orden por FK, secuencia de comprobantes creada antes de referenciarla, `ARRAY` convertido a `integer[]` y comillas en `LogAuditoria` según el nombre de la API del repositorio. `auth.users(id uuid)` es un doble de dependencia: no se recibió el esquema Auth completo. Se agregan únicamente datos de prueba y catálogos con los IDs del contrato actual.

Sobre esa estructura se ejecutan las migraciones reales payment_engine, free_subscription, checkout_atomic, subscription_lifecycle y subscription_policy_v2, antes de renombrar. No se reejecuta receipts sobre el snapshot actual: comprobante_pago.id ya es identity y esa migración histórica intenta SET DEFAULT, incompatible con ese estado. El renombrado no utiliza ni cambia esa tabla. Tampoco se presenta este montaje como una reproducción del historial completo desde cero; el snapshot corresponde al estado existente y se instalan las funciones/índices necesarios de las migraciones reales.

Resultados PostgreSQL:

- Conservación exacta de filas previas, OIDs de tablas, PK/FK/CHECK, índices, secuencias, ACL, metadatos de funciones y triggers.
- Rechazo de FK inválidas, saldo negativo y referencia de crédito duplicada; dependencia entrante FK y vista siguen operativas.
- RLS y política de prueba conservadas. El snapshot no incluye políticas reales: se añade una política explícita solo como prueba de preservación. No se certifican políticas desconocidas de producción.
- Usuarios anon/authenticated sin acceso directo; service_role conserva acceso. Firmas y permisos RPC conservados.
- RPC ejecutadas realmente en PostgreSQL: compra, renovación, crédito proporcional, cambio de plan, pago rechazado, downgrade programado, cancelación, trigger que bloquea renovación pendiente y worker repetido sin duplicados.
- Dos sesiones simultáneas: una suscripción vigente, un pago y un asiento de crédito; segunda operación rechazada tras esperar el lock de usuario.
- Conflicto de destino, función distinta y dependencia adicional: fallo previo sin estado parcial.
- Repetir migración después de aplicarla: falla antes de renombrar, sin pérdida de datos; no es idempotente deliberadamente. El gestor de migraciones debe registrar y aplicar la versión una sola vez.
- Rollback después de escrituras: conserva filas, una RPC vuelve a funcionar en conexión nueva y la migración puede aplicarse de nuevo. Repetir rollback falla de forma segura antes de alterar nada.

Esto valida PostgreSQL con la estructura suministrada y funciones del repositorio; no es E2E de HTTP/Supabase Auth, PostgREST, cron externo ni una inspección de la BD real. No se migró producción.

### Suite JavaScript y regresiones

- `node --test backend/tests/*.test.js`: **36/36 aprobadas**.
- Suite ampliada con los nueve scripts locales de regresión: **76/77 aprobadas**, un fallo preexistente en `active direct viewer share allows download`, backend/scripts/share-access.test.js:39.
- Ese fallo se reprodujo ejecutando el código de la prueba obtenido directamente de HEAD. Test y share.service coinciden con HEAD tras normalizar CRLF; Git no los marca modificados. El doble de compartir devuelve objeto en lugar del array que espera el servicio. No se corrigió aquí porque está fuera del renombrado y el usuario prohibió cambios ajenos/Fase 8.
- Se excluye get-auth-token.test.js: es un script manual con autenticación real, no una prueba aislada.
- La primera ejecución PostgreSQL sufrió un fallo de creación de proceso por recursos del sistema; después se corrigió un delimitador del fixture y la ejecución completa pasó. No se contabilizan ejecuciones interrumpidas como exitosas.

## Reproducir sin producción

Desde esta rama, con Docker disponible y sin un contenedor previo con el mismo nombre:

```powershell
docker run --detach --rm --network none --name cloudbox-rename-validation -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17
node backend/scripts/test-subscription-table-rename.js
docker stop cloudbox-rename-validation
node --test backend/tests/*.test.js
git diff --check
```

Trust se limita al contenedor sin red y datos ficticios; no es configuración de despliegue. No ejecutar scripts locales antiguos que reinician esquemas sobre este ensayo. El runner no recibe una URL ni admite apuntar a Supabase.

## Despliegue propuesto — requiere revisión y autorización

1. Revisar estos ocho archivos y el fallo ajeno pendiente. Obtener copia verificada y exportación de definiciones/permisos del entorno objetivo por el procedimiento autorizado.
2. En staging aislado, comparar catálogo completo de tablas, vistas, triggers, políticas, funciones y dependencias con esta entrega. Verificar que no existan destinos, que estén aplicadas hasta 20261025030000 y que la versión 20261025050000 no esté registrada. Revisar consumidores externos y SQL dinámico fragmentado.
3. Comparar pg_get_functiondef/prosrc de las cuatro funciones con las de la migración histórica revisada; si el guard falla, detenerse y revisar la diferencia, no eliminar la protección.
4. Ejecutar todas las pruebas sobre copia estructural autorizada. Resolver o aceptar explícitamente el fallo de regresión ajeno antes de afirmar cierre global.
5. Pausar productores de suscripciones/worker durante la ventana; aplicar solo la nueva migración mediante el gestor habitual, una vez. No reejecutar el historial.
6. Verificar tablas y filas, ausencia de nombres anteriores en funciones, permisos service_role y smoke de compra/renovación/cambio/cancelación con usuarios de prueba en staging. Las RPC/HTTP conservan sus nombres; no hay backend nuevo que desplegar por este renombrado.
7. Reanudar productores. Los scripts externos de consulta que usen nombres viejos deben actualizarse coordinadamente; no se crean alias ni tablas duplicadas.

## Rollback seguro

El archivo de supabase/rollbacks es manual, NO una migración ascendente adicional:

1. Pausar productores y conservar una copia de las filas y definiciones actuales.
2. Si el renombrado falló dentro de BEGIN/COMMIT, PostgreSQL ya revirtió todo; no ejecutar rollback inverso sobre tablas todavía antiguas.
3. Si se confirmó, verificar que existan los tres nombres españoles, estén libres los antiguos, no haya migraciones posteriores dependientes y las funciones sigan siendo las de esta entrega.
4. Ejecutar el archivo de rollback en la misma ventana. Renombra tablas al inglés y restaura cuerpos previos; conserva OID, filas, escrituras posteriores, ACL, índices y relaciones. No usar DROP TABLE ni restaurar un dump encima de datos nuevos.
5. Verificar filas y RPC. Reconciliar el historial de la versión 20261025050000 mediante el procedimiento del gestor de migraciones autorizado antes de volver a aplicar; no dejar un rollback manual con historial que siga indicando aplicada.
6. Ante cambios posteriores, dependencias adicionales o hashes distintos, el rollback aborta. Preparar una reversión revisada; no desactivar guards ni sobrescribir funciones nuevas.

## Riesgos pendientes

No se declara cierre global: existe un test ajeno fallido y falta validación sobre staging con políticas/funciones reales completas y E2E Supabase. Quedan fuera del alcance la corrección del test de archivos, el estado histórico de receipts/identity, consumidores externos y Fase 8. Las referencias inglesas internas de índices/secuencias no son consultas a tablas antiguas y se mantienen por compatibilidad. Los respaldos y scripts locales anteriores siguen intactos.

## Registro final de Git y verificación

`git diff --check`: exit 0, sin errores. Solo aviso LF/CRLF en Windows. Comprobación adicional de whitespace de los ocho archivos (incluidos nuevos), sintaxis JS y firmas de secretos: aprobada.

Última ejecución PostgreSQL: todos los grupos aprobados, incluidos crédito sobrante Q27, ausencia de pago de monto cero y denegación de tablas/RPC a clientes. El contenedor temporal se detuvo al terminar.

`git status --short` al cerrar la revisión:

```text
 M backend/tests/subscription-policy-v2.test.js
A  docs/CLOUDBOX_FASE8_CONTRATO_JENNIFER.md
 M docs/SUSCRIPCIONES_DECISIONES_TECNICAS.md
?? .payment-module-backup/
?? .subscription-03-backups/
?? backend/scripts/test-subscription-table-rename.js
?? backend/src/app.js.subscription-backup
?? backend/tests/sql/
?? backend/tests/subscription-table-rename.test.js
?? cloudbox_concurrencia/
?? cloudbox_local_final/
?? docs/CLOUDBOX_FASE8_CONTRATOS_AJUSTADOS_DEVELOP.md
?? docs/RENOMBRADO_TABLAS_FASE7.md
?? supabase/migrations/20261025010000_subscription_checkout_atomic.sql.pre-sync-backup
?? supabase/migrations/20261025030000_subscription_policy_v2.sql.pre-concurrency-review-backup
?? supabase/migrations/20261025050000_renombrar_tablas_suscripcion.sql
?? supabase/rollbacks/
```

La entrada A del contrato Fase 8 ya existía antes de esta tarea; no fue preparada ni editada por esta corrección. Los archivos ?? de respaldo tampoco forman parte del manifiesto de ocho archivos.
