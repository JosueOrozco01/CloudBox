# Validación funcional de seguridad — etapa 1

## Estado confirmado

El usuario ejecutó manualmente `20261027_etapa1.sql` en Supabase y verificó los permisos efectivos posteriores: auditoría sin acceso directo de clientes, columnas de rol/estado protegidas, edición de nombre/apellido permitida a authenticated, lectura del catálogo de carpetas conservada y permisos administrativos vigentes. **Aplicado y verificado. No volver a ejecutar el SQL.**

En esta validación no se ejecutó SQL, ni local ni remoto, ni se hicieron solicitudes a Supabase. En la validación inicial no hubo cambios productivos ni commits. Posteriormente el usuario autorizó corregir las dos incidencias de carpetas y organizar dos commits locales. La integración quedó completada en b13c7f3366dc94f1b7662ebe29100a66cfd50f76; las correcciones de seguridad se reúnen en el segundo commit. No hubo push ni merge hacia develop.

## Resultado local

**95 pruebas aprobadas, 0 fallidas** tras las correcciones finales (93 en la validación anterior). Las pruebas afectadas se ejecutaron también por separado: 25 aprobadas, 0 fallidas. Se ejecutaron todos los `*.test.js` de backend/tests y backend/scripts excepto `get-auth-token.test.js`, que requiere credenciales reales. Los runners SQL no forman parte de este comando y no se ejecutaron.

```powershell
$testFiles = @(rg --files backend/tests backend/scripts -g '*.test.js' | Where-Object { $_ -notmatch 'get-auth-token' })
node --test $testFiles
```

Los HTTP usan loopback y dobles de Supabase, sin cargar .env. Los errores internos simulados se registran en el servidor para probar las respuestas sanitizadas de los handlers cubiertos. `git diff --check` y `git diff --cached --check` sin errores.

| Flujo | Validación local | Límite de la evidencia |
|---|---|---|
| Perfil | GET/PATCH mediante user.routes reales, identidad de sesión, nombres válidos e inválidos, campos adicionales sin efecto sobre rol/estado ni otros propietarios | JWT y actualización real con RLS se comprueban manualmente |
| Administración | Middleware de autenticación/rol real, rechazo de cliente/inactivo, protección de cuenta propia, catálogo inválido, cambio autorizado de rol y estado | Clientes de Supabase simulados |
| Desactivación propia | PATCH real, contraseña incorrecta rechazada, cambio de estado y revocación legítima conservados | Verificación de contraseña y revocación simuladas |
| Auditoría | Registro tras cambios confirmados, actor y detalle, ausencia de éxito auditado en fallos, errores internos ocultos; lectura, paginación y registros antiguos en pruebas del servicio | Lectura/escritura reales por service_role pendientes de prueba funcional manual |
| Carpetas | Rutas, controlador y servicio reales: listar propias, crear, renombrar, mover, negar acceso ajeno, validar identificadores y emitir auditoría solo en éxitos | Consultas y RPC simulados; no demuestra la cascada SQL real |
| Papelera/restauración | Firma exacta de RPC y parámetros de identidad, negaciones simuladas, conflictos 409 y fallos internos sanitizados | Estados y relaciones en la base real deben comprobarse manualmente |

Se corrigió una limitación del test anterior: montaba desactivación con POST aunque la ruta productiva es PATCH. Ahora se monta user.routes real. Se añadió `backend/tests/security-folders.test.js`; no se modificaron los servicios ni el SQL para hacer pasar pruebas.

## Incidencias adicionales corregidas por autorización expresa

1. **Movimiento a destino ajeno:** ahora devuelve 403 con el código público EDITOR_PERMISSION_REQUIRED y el mensaje genérico «La carpeta destino no existe o no tienes permisos.». La regresión compara toda la carpeta antes y después para confirmar que no se modifica ningún campo.
2. **Errores internos legacy:** los siete handlers de listar, consultar, crear, renombrar, subcarpetas, contenido y mover delegan sus errores internos al middleware existente. Se prueban status ausente, 500 y 503 para cada handler; las respuestas no contienen el mensaje interno. Se conservan los códigos y mensajes públicos 4xx, con pruebas específicas de validación y acceso compartido. Papelera/restauración conservan sus mensajes públicos específicos.

La solución está en folder.controller.js y en la validación de destino de folder.service.js. No se cambian permisos remotos, RPC ni reglas comerciales.

## Comprobación real que realiza el usuario

Usar una cuenta administradora y dos cuentas de prueba propias A/B, con sesiones separadas. Mantener la sesión administradora activa para restaurar los cambios. Utilizar los IDs y valores del catálogo real; no deducir IDs de los fixtures locales. Anotar previamente los valores que se cambien y restaurarlos al terminar. Las contraseñas y JWT permanecen en el navegador/cliente local y no se comparten en el informe.

Ejecutar estos pasos manualmente desde la aplicación conectada al proyecto correcto; si la interfaz no expone una operación, usar su API con el JWT de la sesión correspondiente en un cliente local. No se requiere ejecutar SQL adicional ni volver a probar permisos ya verificados mediante inserciones directas.

| Caso | Pasos y endpoints de referencia | Resultado esperado |
|---|---|---|
| Perfil propio | Con A, GET `/api/users/me`; PATCH con nombre/apellido de prueba; recargar y volver a iniciar sesión; restaurar valores | Cambios persisten; ID, correo, rol y estado permanecen iguales; B no cambia |
| Campos y validación | Con A, enviar nombre vacío en PATCH; si se prueba cuerpo con id de B/id_rol/id_estado, acompañarlo solo de nombres de prueba de A | Vacío: 400. Campos fuera de la lista permitida no modifican B, rol ni estado |
| Administración denegada | Con A, GET `/api/admin/audit-logs`; PATCH `/api/admin/users/{B}/role` o `/status` | 403 y ningún cambio sobre B; sin JWT: 401 |
| Administración legítima | Con administrador, cambiar temporalmente rol de B mediante PATCH `/api/admin/users/{B}/role` y restaurar; cambiar estado mediante `/status` y restaurar | 200, persistencia y efecto al autenticar B; no se pierde la sesión administradora. No modificar el rol/estado de la propia cuenta administradora |
| Auditoría | Tras los cambios anteriores, GET `/api/admin/audit-logs?limit=20&offset=0` como administrador | Acción, actor administrador, destinatario B y detalle correctos. Un registro por cada cambio exitoso, incluyendo restauraciones. Revisar también la segunda página si procede |
| Carpeta propia | Con A, crear dos carpetas vacías con nombres únicos; dentro de una crear una subcarpeta; renombrar y mover la otra | Crear 201, renombrar/mover 200, listado y recarga consistentes; todas siguen perteneciendo a A |
| Acceso ajeno | Con B sin compartir, intentar renombrar o usar como destino una carpeta de A, solo sobre estas carpetas de prueba | No se modifica ninguna carpeta de A. El movimiento a destino ajeno debe responder 403 EDITOR_PERMISSION_REQUIRED; registrar cualquier 500 como fallo |
| Papelera y cascada | Con A, DELETE `/api/folders/{raizDePrueba}`; GET `/api/folders/trash`; comprobar raíz y subcarpetas en la interfaz | Se envía a papelera solo el árbol de A; no afecta B. No es borrado permanente |
| Restauración | Con A, PATCH `/api/folders/{raizDePrueba}/restore`; recargar árbol | Vuelve al estado activo con sus relaciones y nombres. Si se usa también un archivo de prueba sin información sensible, verificar su recuperación y descarga |
| Identidad RPC | Sobre una carpeta desechable de A, intentar papelera/restauración desde B sin compartir | Acceso denegado y árbol de A intacto. Registrar status y código; un 500 exige revisión, no demuestra una denegación correctamente manejada |
| Auditoría de carpetas | Como administrador, revisar los eventos CREAR_CARPETA y ELIMINAR_CARPETA de estos pasos | Actor A, entidad e ID correctos; sin registros exitosos para intentos denegados. No exigir eventos nuevos de restauración/movimiento que el contrato actual no produce |

Para cada caso guardar: fecha/hora, cuenta A/B/administrador, operación, status/código, resultado al recargar y restauración de valores. Los cambios administrativos y de carpetas son reales: realizarlos solo con las cuentas y recursos de prueba elegidos por el usuario. No vaciar la papelera ni eliminar permanentemente recursos para esta validación.

La desactivación propia puede comprobarse opcionalmente con una cuenta de prueba recuperable desde la sesión administradora: PATCH `/api/users/me/deactivate`, contraseña correcta, acceso posterior denegado y reactivación administrativa. No es necesario repetirla con la cuenta habitual para validar los tres cambios de permisos.

## Cierre y paso a etapa 2

Los permisos remotos ya están aplicados y verificados; no existe una aplicación SQL pendiente. La validación local funcional es satisfactoria dentro del alcance descrito. Para cerrar la validación funcional real faltan los resultados manuales, especialmente la persistencia del perfil con JWT, la auditoría vía backend y la cascada/restauración de carpetas. Los RPC reales no se certifican mediante sus dobles.

Las dos incidencias adicionales de carpetas quedaron corregidas y cubiertas por regresiones locales; la comprobación manual debe hacerse usando esta versión del backend. No se implementaron correcciones comerciales durante esta revisión.

La etapa 2 mantiene el orden acordado: bypass de subscribe, reglas Free respetando el trigger real, créditos históricos, límites de fecha_fin y cálculo de cuotas/reportes. No requiere repetir el renombrado, los RPC comerciales ni el cron ya verificados. El usuario autorizó dos commits locales y la fusión ya fue confirmada separando integración y seguridad. No se autoriza push, PR ni integración hacia develop. La adaptación de notificaciones y productores externos sigue en una etapa posterior.
