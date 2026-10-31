# Estado revisado de CloudBox — 18 de octubre de 2026

Revisión del código actual, rutas del backend, navegación del frontend, documentación, compilación, ESLint y pruebas locales. Implementado significa presente en el código; no equivale a validación completa en producción. No se modificaron datos de cuentas ni se aplicaron migraciones durante esta revisión.

## Funciones presentes y conectadas

| Área | Disponible |
| --- | --- |
| Autenticación | Registro, confirmación, inicio/cierre de sesión y recuperación de contraseña. |
| Inicio del cliente | Resumen, almacenamiento, archivos recientes, búsqueda y accesos a subir, crear carpeta y compartidos. |
| Mis archivos | Consultar, subir, crear carpetas, renombrar, mover, ordenar, abrir, obtener descarga y enviar a papelera. |
| Papelera | Consultar y restaurar archivos/carpetas; el borrado permanente de archivos dispone de API, sin botón conectado en el explorador actual. |
| Compartidos | Archivos y carpetas recibidos/enviados, permisos, vencimiento, información y revocación. Navegación de carpetas y apertura/descarga de archivos con validación de acceso. |
| Selector de destinatario | Sugerencias de cuentas activas por prefijo de correo y selección por clic/teclado. |
| Favoritos | Agregar/quitar archivos propios o accesibles. Mis favoritos es una colección de referencias, sin mover los originales. |
| Administración | Resumen de métricas, consulta/detalle de usuarios y cambios de estado/rol según permisos. |
| Actividad administrativa | Acciones nuevas del cliente registradas en LogAuditoria; panel y campana exclusivos de administrador con consulta periódica. |
| Perfil | Consultar y actualizar nombre/apellido; cambiar contraseña dentro de Seguridad; cerrar sesión y desactivar cuenta. |
| Preferencias | Tema claro/oscuro/sistema, vista previa, guardado en metadatos de la cuenta y unidades KB/MB. |
| Preferencias de correo | Interruptores editables y guardado en backend. No entregan correos automáticamente. |
| Sesiones | Sesión actual y accesos registrados por CloudBox desde la incorporación del registro; navegador, sistema, IP y ubicación aproximada para IP pública. Cierre de otras sesiones. |
| Presentación | Pestañas de configuración, páginas legales adaptadas a la sesión, controles lista/cuadrícula comunes, alineación de acciones y tema oscuro/loading. |

## Funciones parciales o pendientes

- Envío automático de correos por almacenamiento, renovaciones, compartidos o actividad: no implementado. No confundir con los correos de autenticación que ya tienen su flujo.
- Favoritos de carpetas: no implementado con el esquema actual.
- Descargar carpetas completas en ZIP: no implementado; botón deshabilitado.
- Editar el contenido de archivos compartidos: esta pantalla permite consultar y descargar; asignar Editor no añade un editor de documentos.
- Borrado permanente desde la papelera: existe `DELETE /api/files/:id/permanent`, pero falta una acción conectada en el frontend.
- Alta de usuarios desde administración: no se encontró API ni flujo administrativo de creación; el registro público sí existe.
- Cambiar foto de perfil: el botón existe, pero no tiene acción de subida conectada.
- Otros idiomas: opciones visibles deshabilitadas; la aplicación mantiene español.
- Borrado permanente de la cuenta y todos sus datos: no implementado; se desactiva conservando los datos.
- Historial personal de actividad: existe servicio, controlador y ruta autenticada `GET /api/activity`, pero falta una pantalla que lo consuma.
- Mi Plan (`/plan`), Pagos (`/pagos`) y Soporte (`/soporte`): enlaces presentes sin rutas de aplicación implementadas. El acceso a administrar planes de Inicio muestra que no está disponible.
- Páginas administrativas de Planes, Suscripciones, Almacenamiento y Métricas: enlaces presentes sin rutas propias. El dashboard sí consulta métricas y distribuciones de uso.
- Sesiones: no es un inventario completo en tiempo real de Supabase. No reconstruye accesos anteriores, geolocaliza IP privadas ni garantiza reflejar cierres externos o renovaciones ajenas al flujo de CloudBox.
- Descargas: el evento confirma autorización o emisión de URL, no la recepción completa del archivo por el navegador.
- Lectura de notificaciones administrativas: se guarda por administrador en el navegador; no se sincroniza entre dispositivos.

## Coexistencia de los registros de actividad

El backend actual registra actividad personal en `actividad` mediante ActivityService y auditoría administrativa en `LogAuditoria` mediante el middleware de rutas. Son fuentes distintas. La campana consulta la segunda. La descarga de un compartido mediante `/api/shares/files/:id/download-url` usa LogAuditoria, pero su servicio no invoca ActivityService: no debe suponerse que ambos historiales tienen cobertura idéntica.

## Verificación ejecutada

- Compilación de producción: aprobada.
- Nueve archivos de pruebas locales, excluyendo el script que inicia sesión con credenciales reales: **40 casos aprobados y 1 fallido, de 41**.
- Fallo: `backend/scripts/share-access.test.js`, caso de descarga con permiso directo Visualizador. El mock devuelve un objeto de permiso, mientras el servicio actual consulta una lista; actualizar el mock y revisar las demás pruebas del mismo contrato. No se confirma un fallo de descarga real únicamente por ese resultado.
- ESLint completo: tres errores en `frontend/src/context/authContext.jsx` (exportaciones de Fast Refresh), `frontend/src/pages/Login/LoginPage.jsx` y `frontend/src/pages/Profile/StorageSummary.jsx` (actualizaciones síncronas de estado desde efectos).
- Pendientes: pruebas integrales con dos cuentas/dispositivos, revisión visual de todas las pantallas en ambos temas y comprobación de correo/proxy/geolocalización en el despliegue real.

La revisión actualizó esta documentación; no implementó módulos nuevos ni corrigió los hallazgos del análisis.
