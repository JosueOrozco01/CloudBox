# Seguridad, etapa 1 — aplicado y verificado

Estos scripts **no son migraciones pendientes ni se ejecutan desde la aplicación**. Se prepararon a partir de las exportaciones reales de Supabase del 27/10/2026 y de `INFORME_SUPABASE_REAL_20261027.md`. El agente no ha ejecutado SQL remoto; la aplicación manual realizada por el usuario se registra a continuación. Las migraciones históricas no determinan qué falta en producción.

**Estado actual:** el usuario confirmó la ejecución manual satisfactoria de 20261027_etapa1.sql y los permisos posteriores esperados. No volver a ejecutar ese SQL. La siguiente secuencia describe el procedimiento histórico; ya no es una tarea pendiente. Las comprobaciones funcionales restantes están en docs/VALIDACION_FUNCIONAL_ETAPA1_20261027.md.

Procedimiento original de revisión (histórico):

1. Revisar `20261027_inspeccion.sql`, ejecutarlo en SQL Editor con el acceso administrativo habitual y guardar su JSON completo. Captura permisos de tablas, columnas y secuencias, propietarios, RLS, políticas y permisos efectivos. No modifica información.
2. Contrastar ese resultado con las exportaciones revisadas. Se esperan `usuario` con RLS y política de actualización del perfil propio, `LogAuditoria` y `estado_carpeta` sin RLS forzado, y `service_role` con capacidad de eludir RLS. Revisar también membresías si aparece un permiso efectivo inesperado.
3. Revisar `20261027_etapa1.sql` y decidir manualmente su ejecución. Incluye BEGIN/COMMIT y verificaciones que cancelan toda la transacción ante deriva de permisos o políticas. No ejecutar archivos históricos para acompañarlo.
4. Volver a guardar el JSON de inspección. `anon` y `authenticated`: auditoría SELECT/INSERT falsos; usuario id_rol/id_estado UPDATE falsos; `authenticated`: nombre UPDATE verdadero; catálogo de carpetas SELECT conservado y escritura falsa. `postgres` y `service_role` conservan las operaciones administrativas.
5. Después de aprobar y aplicar manualmente, verificar los flujos legítimos desde la aplicación con cuentas de prueba: perfil propio, administración de roles/estados, consulta de auditoría y papelera/restauración. Las pruebas locales no certifican las credenciales, JWT, roles heredados ni los RPC reales de producción.

## Qué modifica

- Revoca todos los privilegios de tabla y columna de `LogAuditoria` a PUBLIC, anon y authenticated. Conserva lectura e inserción del backend con `service_role` y el acceso administrativo del propietario.
- Revoca UPDATE general y por columna de `usuario` a esos clientes, concediendo exclusivamente UPDATE(nombre, apellido) a authenticated. La política existente sigue limitando la operación al perfil propio. No altera INSERT/SELECT de usuario, políticas, propietarios ni atributos de roles.
- Revoca escrituras de tabla y columna del catálogo `estado_carpeta`, conservando SELECT. Conserva sus operaciones internas con service_role.
- Protege las secuencias de identidad de auditoría y del catálogo frente a clientes; concede USAGE/SELECT a service_role. No reinicia secuencias ni cambia identificadores.

No añade triggers de bloqueo: Dashboard/SQL Editor con `postgres` o acceso administrativo equivalente sigue pudiendo editar id_rol/id_estado. Un usuario con JWT normal, aunque su rol de negocio sea Administrador, utiliza los endpoints administrativos del backend; no obtiene permisos directos de PostgreSQL sobre columnas protegidas.

No cambia funciones RPC, triggers de Free, tablas comerciales, cuotas, pagos, suscripciones, notificaciones, datos ni estados de lectura. No instala RLS forzado. La ausencia de nuevas políticas en auditoría/catálogo es intencional: se restringen mediante ACL efectivas y se mantienen sus flujos internos.

## Reversibilidad y deriva

Un error de precondición, permisos heredados o falta de capacidad administrativa cancela la transacción completa. Si SQL Editor deja una transacción abortada, usar ROLLBACK en esa misma sesión antes de continuar. No resolver errores agregando CASCADE ni abriendo permisos a clientes.

Para una reversión posterior al COMMIT, conservar el JSON anterior y preparar/restaurar únicamente las ACL necesarias, con revisión administrativa. Las ACL de columna y secuencia se restauran por separado de las de tabla; una ACL null representa los valores predeterminados del propietario. No se entrega un rollback que reabra automáticamente la vulnerabilidad. No hace falta restaurar datos, estructuras ni funciones porque no se modifican. Los permisos heredados desconocidos requieren revisar el rol que origina la concesión; el script no altera roles ajenos a ciegas.

## Prueba aislada reproducible

Requiere Docker local con postgres:17 disponible. El contenedor de prueba no tiene red, puertos publicados ni carpetas compartidas:

```powershell
docker run --name cloudbox-security-stage1 --network none --label cloudbox.task=security-stage1 -e POSTGRES_HOST_AUTH_METHOD=trust -d postgres:17
docker exec cloudbox-security-stage1 pg_isready -U postgres
node backend/scripts/test-security-stage1.js
docker rm -fv cloudbox-security-stage1
```

Ejecutar el runner cuando pg_isready confirme disponibilidad. El runner rechaza una imagen, red, etiqueta o montaje distintos; no carga .env ni admite conexiones remotas. Usa un extracto estructural local de las tres tablas afectadas y sus dependencias, con auth.uid simulado y datos ficticios. No recrea todo Supabase ni instala migraciones comerciales. Crea y elimina su base y roles dentro del contenedor exclusivo.
