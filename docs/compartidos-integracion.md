# Integración de compartidos

La ruta `/compartidos` requiere sesión de cliente. Se usa el token existente y la URL configurada mediante `VITE_API_URL`.

La pantalla consulta archivos y carpetas recibidos y permite buscar, filtrar, ordenar, paginar, abrir carpetas y abrir o descargar archivos. Información y Más opciones consultan el detalle del compartido; en el contenido de una carpeta muestran el permiso heredado. La descarga de carpetas completas no está disponible (botón deshabilitado).

Compartidos por mí consulta los envíos y ofrece cambiar permisos y revocar accesos desde Información. Compartir archivo o carpeta permite seleccionar recursos propios, destinatario por correo, permiso y fecha de vencimiento opcional.

## Endpoints añadidos

- `POST /api/shares/folders`
- `GET /api/shares/received/folders`
- `GET /api/shares/folders/:id/content`
- `GET /api/shares/files/:id/download-url`

Los POST de archivos y carpetas aceptan `receiverEmail` además de `receiverUserId`. La identidad emisora siempre proviene de la sesión. El acceso a contenido y descargas valida permisos activos, vencimiento y estado del recurso; solo el emisor puede cambiar permisos o revocar. Las URL firmadas duran 60 segundos.

## Verificación

- `cd frontend` y `npm run build`
- `node --test backend/scripts/share-access.test.js`
- Con dos cuentas de prueba: compartir archivo y carpeta, consultar con la receptora, navegar subcarpetas y descargar; revocar con la emisora y comprobar que la receptora pierde acceso al actualizar.

No se ejecutaron operaciones contra datos reales. Las acciones del cliente se registran automáticamente en la auditoría administrativa. Favoritos está integrado como se describe más abajo. El permiso Editor se muestra y administra; esta pantalla ofrece consulta y descarga, sin edición del contenido.


## Estado del listado solicitado

“Hecho” indica implementación en código; la prueba completa con dos cuentas y Supabase sigue pendiente.

| Tarea del listado | Estado |
| --- | --- |
| Conectar backend con compartir | Hecho |
| Crear servicio de Compartir | Hecho |
| Validar usuario emisor | Hecho |
| Validar usuario receptor | Hecho |
| Validar archivo compartido | Hecho |
| Validar carpeta compartida | Hecho |
| Validar permiso | Hecho |
| Validar estado del compartir | Hecho |
| Validar fecha de expiración | Hecho |
| Crear API para compartir archivo | Hecho |
| Crear API para obtener archivos compartidos por el usuario | Hecho: `/shares/sent` |
| Crear API para obtener archivos que le compartieron al usuario | Hecho |
| Crear API para cancelar/revocar un compartir | Hecho |
| Crear API para cambiar permiso | Hecho |
| Crear API para consultar información del compartir | Hecho |
| Crear API para compartir carpeta | Hecho |
| Obtener carpetas compartidas conmigo | Hecho |
| Obtener carpetas que compartí | Hecho: `/shares/sent` incluye carpetas |
| Revocar acceso a carpeta | Hecho: revocación del compartido |
| Cambiar permisos de carpeta | Hecho: permiso del compartido |
| Validar acceso a contenido de carpeta compartida | Hecho: validación directa y heredada |
| Crear servicio de Favoritos | Hecho: integración del backend de `origin/backend/resource-manage` |
| Crear API para agregar archivo a favoritos | Hecho: integración del backend de `origin/backend/resource-manage` |
| Crear API para eliminar favorito | Hecho: integración del backend de `origin/backend/resource-manage` |
| Crear API para obtener favoritos del usuario | Hecho: integración del backend de `origin/backend/resource-manage` |
| Validar que el archivo pertenezca o sea accesible para el usuario al agregar favoritos | Hecho: integración del backend de `origin/backend/resource-manage` |
| Evitar favoritos duplicados | Hecho: integración del backend de `origin/backend/resource-manage` |
| Crear servicio de Actividad del cliente | Hecho: registro en `LogAuditoria`, visible únicamente al administrador |
| Registrar acciones automáticas del cliente | Hecho: registro en `LogAuditoria`, visible únicamente al administrador |
| Registrar actividad al subir archivo | Hecho: registro en `LogAuditoria`, visible únicamente al administrador |
| Registrar actividad al descargar archivo | Hecho: registro en `LogAuditoria`, visible únicamente al administrador |
| Registrar actividad al eliminar archivo | Hecho: registro en `LogAuditoria`, visible únicamente al administrador |
| Registrar actividad al compartir archivo | Hecho: registro en `LogAuditoria`, visible únicamente al administrador |
| Registrar actividad al compartir carpeta | Hecho: registro en `LogAuditoria`, visible únicamente al administrador |
| Registrar actividad al eliminar carpeta | Hecho: registro en `LogAuditoria`, visible únicamente al administrador |
| Crear API para consultar actividad del usuario | Implementada en backend: `GET /api/activity`; sin pantalla de historial personal |

## Diseño y notificaciones

Se reutilizan los estilos de los modales de CloudBox: cabecera con icono, campos, botones primario y secundario, pie de acciones y adaptación móvil. Se estilizaron las pestañas de recibidos/enviados, actualización, filtros, cuadrícula, estado de carga, errores y administración de permisos. Los modales soportan Escape, control del foco, cierre al pulsar fuera y bloqueo del desplazamiento del fondo. Las operaciones muestran confirmaciones visuales.

Las notificaciones están disponibles únicamente en el administrador y conservan su fuente de auditoría. El área del cliente no muestra campana ni consulta notificaciones de compartidos. Las confirmaciones de acciones en Compartidos se muestran como mensajes temporales.


## Favoritos y controles de Mis archivos

Se incorporaron únicamente servicio, controlador y rutas de favoritos desde la referencia local `origin/backend/resource-manage`; no se fusionó la rama completa. La API original usa `GET /api/favorites`, `POST /api/favorites/:fileId` y `DELETE /api/favorites/:fileId`. La sesión determina el usuario; solo se aceptan archivos accesibles y se ocultan los favoritos cuyo acceso haya vencido o se haya revocado.

Mis archivos muestra una carpeta especial predeterminada **Mis favoritos** (`/archivos?favorites=1`). Es una colección de referencias: no crea copias ni mueve archivos. Las estrellas de Acciones permiten agregar y quitar archivos tanto en Mis archivos como en Compartidos. Se guardan en el backend y se deshabilitan temporalmente durante la operación. Los archivos ajenos se abren con validación de acceso y no ofrecen acciones para renombrar, mover o enviar a papelera.

### Base de datos existente, sin migraciones

La tabla existente `favorito` tiene `id`, `fecha_agregado`, `id_usuario` e `id_archivo`. Se usan únicamente `GET /api/favorites`, `POST /api/favorites/:fileId` y `DELETE /api/favorites/:fileId`.

Las carpetas no admiten estrellas porque el esquema actual no guarda favoritos de carpetas. Se retiraron el servicio y las rutas de carpetas favoritas, sus consultas desde ambas páginas y el archivo de migración propuesto. No se modificó la base de datos.

Los avisos amarillos de Mis archivos y Compartidos se originaban en consultas a la tabla inexistente `favorito_carpeta`. El manejador global ocultaba el detalle interno con “An unexpected error occurred”. Se eliminó la dependencia que causaba el error; no se ocultaron errores reales del servicio de favoritos de archivos.

El acceso **Compartido conmigo** de Inicio abre `/compartidos`. Mis archivos y Compartidos reutilizan `ViewToggle` para mostrar el mismo selector de lista/cuadrícula. Los iconos de los botones de Mis archivos usan 16 px y las acciones tienen áreas de 34 px, alineación y estados de foco comunes.

### Verificación adicional

- Pruebas de favoritos y compartidos con `node --test backend/scripts/favorite-access.test.js backend/scripts/share-access.test.js`.
- Compilación del frontend y ESLint sobre los componentes modificados.
- Verificación de solo lectura contra Supabase: tabla existente y servicio de favoritos de archivos funcionando. No se registraron datos de usuarios ni se realizaron escrituras.
- Pendiente: revisión visual en navegador y prueba manual de agregar/quitar estrellas con dos cuentas.


## Actividad automática y campana administrativa

Las rutas de subida, descarga, eliminación de archivos, compartir archivos/carpetas y eliminar carpetas registran eventos en la tabla existente `LogAuditoria`. También se registra crear carpeta. No se requieren tablas nuevas ni migraciones. La identidad proviene de la sesión autenticada; un usuario no puede enviar el identificador de otro actor para el registro.

Se registra después de una operación exitosa. Validaciones rechazadas y operaciones fallidas no aparecen como completadas. Un fallo de auditoría se informa en el servidor y no convierte una operación exitosa en error. La eliminación a papelera y la eliminación permanente de archivos tienen descripciones distintas. Eliminar una carpeta genera un evento de la operación en cascada, sin inventar acciones individuales para cada archivo interno.

Las rutas de descarga propias y compartidas registran **Descarga autorizada** al emitir una URL temporal o redirección; no se confirma la descarga completa en el navegador. Abrir un archivo usa la misma autorización y también genera ese evento. No se guardan URL firmadas, tokens ni contenido del archivo en la auditoría.

El panel y la campana comparten `GET /api/admin/audit-logs`, protegido para administradores. Muestran actor, acción, recurso y resultado; los nombres de recursos no se confunden con usuarios que tengan el mismo identificador. El panel actualiza la actividad cada cinco segundos mientras la pestaña está visible, al recuperar el foco y tras acciones administrativas. Ver más actividad amplía la lista hasta los últimos 100 eventos. La campana conserva su contador y lectura por administrador/navegador. Los clientes no tienen campana.

La integración registra las acciones nuevas desde su instalación; no reconstruye acciones pasadas. El backend actual también dispone de `GET /api/activity` para consultar la actividad propia; el frontend aún no lo consume.


## Sugerencias de destinatarios

El campo de correo de Compartir consulta `GET /api/shares/recipients?q=...` después de escribir dos caracteres y esperar 250 ms. Busca por inicio de correo, sin distinguir mayúsculas, entre usuarios activos; excluye al usuario autenticado y devuelve hasta ocho coincidencias con nombre, apellido y correo. No necesita migraciones ni utiliza las APIs administrativas de usuarios.

El desplegable permite seleccionar con clic o con flechas y Enter; Escape lo cierra sin cerrar el formulario. Al elegir se completa el correo que usa la validación de compartir existente. Las búsquedas anteriores se cancelan al escribir o cerrar, para evitar resultados desactualizados. Se muestran estados de búsqueda, lista vacía y error, y sigue siendo posible escribir el correo completo manualmente.
