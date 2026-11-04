# Integraciones completadas

Fecha: 31 de octubre de 2026.
Actualización de nombres y procedimiento de instalación: 4 de noviembre de 2026.

Se implementaron los pendientes de `REVISION-INTEGRACION-BACKEND-FRONTEND.md`. El estado de instalación y las limitaciones de validación se detallan abajo.

## Cambios en código

- Una sola URL de API configurada por `VITE_API_URL` para login, registro, recuperación, perfil, cierre de sesión y los módulos restantes.
- Renovación del token mediante `POST /api/auth/refresh`, comprobación de cuenta activa y reintento único de peticiones autenticadas. Una renovación concurrente comparte la misma operación; no restaura sesiones cerradas ni reintenta con una cuenta diferente.
- Renovación preventiva antes de subir archivos mediante XMLHttpRequest.
- Reportes de almacenamiento y CSV sin el recorte de 100 usuarios. El modo completo es interno; el endpoint público administrativo conserva su límite de paginación.
- Acceso rápido del dashboard conectado a `/plan`.
- Usuarios administrativos conectados a listado paginado, detalle individual y catálogo/resumen independiente. Los filtros de búsqueda, estado, plan, fecha y orden están implementados en el backend.
- Detalle de usuarios con suscripción vigente y fotos existentes; el catálogo no se vuelve a consultar en cada búsqueda.
- Auditoría administrativa paginada, orden estable por fecha e ID y acceso desde el dashboard al historial completo.
- Lecturas administrativas persistentes por administrador, sin eliminar auditoría. Los estados locales anteriores se importan cuando el backend está disponible.
- Métricas de promedio, carpetas y usuarios que originan alertas de cuota.
- Detalle de transacciones administrativas desde el reporte de ingresos y descarga de comprobantes.
- Pantalla `/verificar-correo` con verificación manual y reenvío; validación y espera entre solicitudes repetidas.
- Solicitudes de soporte: creación, listado paginado, conversación, respuestas, estado y atención administrativa. Un cliente solo puede consultar sus solicitudes y cerrarlas; los administradores pueden atenderlas y reabrirlas.
- Cambio de foto en el perfil: PNG/JPG/WebP de hasta 2 MB, verificación de firma y MIME, archivos privados y URL temporal. Si falla la actualización del perfil, se retira la nueva subida.
- Corrección de la separación del contexto de autenticación para permitir que ESLint del frontend completo pase.

Los endpoints alternativos de descarga, pago y estadísticas que ya tenían un flujo equivalente no se agregaron como acciones duplicadas. Los webhooks y las rutas de diagnóstico permanecen fuera de la interfaz.

## Instalación en Supabase

El bucket privado `avatars` se creó en el Supabase configurado, con límite de 2 MB y los tres tipos de imagen permitidos. No se alteraron archivos anteriores.

Falta ejecutar la migración:

`supabase/migrations/20261103000000_fix_audit_consistency.sql`

Crear tablas por REST no está permitido por la API de datos de Supabase. Las credenciales disponibles corresponden a la API y no hay una conexión SQL ni un proyecto CLI enlazado. La comprobación remota confirmó que las tablas y la función nuevas todavía no están disponibles.

La migración agrega:

- `lectura_notificacion_administrador` para lecturas por administrador y evento.
- `solicitud_soporte` y `mensaje_soporte` para solicitudes y conversaciones.
- `limpieza_almacenamiento` para objetos pendientes de limpieza.
- `cloudbox_create_ticket` para guardar la solicitud y el primer mensaje en una misma transacción.
- Restricciones de datos, índices y RLS. El acceso directo de `anon` y `authenticated` queda revocado; las operaciones pasan por el backend y sus verificaciones de identidad/permisos.
- Creación del bucket privado si no existe.

Aplicar el archivo completo en el editor SQL de Supabase, o con el procedimiento habitual de migraciones del proyecto. El SQL usa una transacción y no borra tablas ni registros existentes.
La migración actual conserva los datos al renombrar las tablas anteriores en inglés, si existen. El archivo del 31 de octubre se conserva como historial; para el esquema actual proporcionado se utiliza el archivo del 3 de noviembre indicado arriba.

Después, reiniciar el backend y comprobar desde la raíz del repositorio:

```powershell
node --env-file=backend/.env backend/scripts/check-integrations.js
```

El comando comprueba las tablas y el bucket sin mostrar credenciales ni datos personales. Un error `PGRST205` indica que la tabla no está disponible en la API. Si acaba de aplicarse la migración, esperar a que PostgREST recargue su esquema.

La utilidad `prepare-integrations.js` verifica las columnas y la función, y crea el bucket si falta; no ejecuta migraciones SQL.

**Hasta aplicar la migración, las funciones nuevas de soporte y lectura persistente de avisos no están operativas.** El cambio de foto y las correcciones que utilizan tablas ya existentes no dependen de ella.

## Verificación

- ESLint del frontend completo: correcto.
- Compilación Vite: correcta. Se mantiene el aviso de tamaño del paquete JavaScript.
- 14 pruebas nuevas aprobadas en `backend/tests/integrations-complete.test.js` y `frontend/tests/session.test.mjs`: permisos, aislamiento por usuario, persistencia por administrador, validación de imágenes, reportes y CSV con 250 usuarios, renovación y cambios concurrentes de sesión, y límites de reenvío.
- Suite previa: se ejecutó tanto sobre los cambios como sobre una copia temporal de `HEAD`. La copia original tenía 61 pruebas aprobadas y 7 fallidas. Los cambios de paginación y validación corrigen dos de esas fallas. Resultado final de la suite backend: 78 pruebas, 73 aprobadas y 5 fallidas. Permanecen cinco fallas previas relacionadas con fixtures/contratos de seguridad, auditoría y prioridad de errores de cuota; no se cambiaron esos tests para ocultarlas.
- Comprobación real de solo lectura en Supabase: listado paginado, detalle individual, filtros de usuarios y reporte completo de almacenamiento correctos. Puede repetirse con `node --env-file=backend/.env backend/scripts/smoke-admin-integrations.js`.
- No se probó soporte persistente contra la base remota porque falta instalar las tablas; las pruebas HTTP de sus permisos usan dobles locales de la base de datos.

Pruebas focalizadas desde la raíz:

```powershell
node --test backend/tests/integrations-complete.test.js frontend/tests/session.test.mjs
npm --prefix frontend run lint
npm --prefix frontend run build
```
