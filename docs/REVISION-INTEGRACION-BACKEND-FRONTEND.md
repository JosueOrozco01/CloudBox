# Revisión de integración backend–frontend

Fecha: 31 de octubre de 2026.

Actualización: la implementación posterior y su estado de instalación están en [INTEGRACIONES-COMPLETADAS.md](INTEGRACIONES-COMPLETADAS.md). Los hallazgos siguientes documentan el estado anterior.
Alcance: lectura de rutas Express, controladores, servicios y consumidores React. No se hicieron peticiones a la base de datos ni pruebas con cuentas reales. La existencia de una conexión en código no confirma que funcione en el entorno desplegado. No se modificó la lógica de la aplicación durante esta revisión.

## Hallazgos priorizados

### 1. Alta: autenticación y perfil ignoran la URL configurada del backend

El resto de los servicios utiliza `VITE_API_URL`, pero login, registro, recuperación, cierre de sesión y perfil apuntan a `http://localhost:3000`. Si se despliega el frontend usando una API remota, estas operaciones siguen consultando el equipo del visitante.

Referencias: `frontend/src/pages/Login/LoginPage.jsx:61`, `frontend/src/pages/Register/Register.jsx:72`, `frontend/src/pages/RecoverPassword/Recover.jsx:62`, `frontend/src/services/authService.js:3`, `frontend/src/services/profileService.js:1`.

Pendiente: unificar estas peticiones con la base de URL normalizada y los servicios de API existentes.

### 2. Alta: reportes y CSV de almacenamiento pueden quedar incompletos

`getStorageReport()` pide 1,000 usuarios, pero `getStorageUsers()` limita cualquier consulta a 100. El CSV repite la misma consulta. Con más de 100 usuarios, las alertas se calculan sobre una lista parcial y el promedio divide el consumo global entre un número parcial de usuarios. El CSV solo exporta los primeros 100.

Referencias: `backend/src/services/report.service.js:511`, `backend/src/services/report.service.js:655`, `backend/src/services/admin-storage.service.js:164`, `backend/src/services/admin-storage.service.js:275`.

Pendiente: recorrer todas las páginas o separar el cálculo global de la consulta paginada. Este es un fallo del backend que afecta lo mostrado y exportado por el frontend.

### 3. Media: el acceso rápido al plan no está conectado

El dashboard incluye una acción con `id: "plan"`, pero su manejador solo reconoce `upload`, `folder` y `shared`. El resto termina en el aviso de función próxima. La ruta `/plan` y sus flujos de contratación ya existen.

Referencias: `frontend/src/pages/Dashboard/Dashboard.jsx:52`, `frontend/src/pages/Dashboard/Dashboard.jsx:428`, `frontend/src/pages/Dashboard/Dashboard.jsx:463`.

Pendiente: conectar la acción a `/plan`.

### 4. Media: la API paginada de usuarios no se consume

Existen `GET /api/admin/users` con búsqueda, estado y paginación, y `GET /api/admin/users/:id`. La pantalla usa `/admin/overview`, descarga todos los usuarios y filtra/pagina en memoria. El detalle también se obtiene de esa copia local, sin solicitar el endpoint individual.

Referencias: `backend/src/routes/admin.routes.js:31`, `frontend/src/pages/UserManagement/ConnectedUserManagement.jsx:32`, `frontend/src/pages/UserManagement/ConnectedUserManagement.jsx:93`, `frontend/src/pages/UserManagement/ConnectedUserManagement.jsx:175`.

Pendiente: agregar consumidores del listado y detalle, conservar las métricas generales por separado y contemplar que filtros de plan, fecha y orden actuales no están todos implementados en el endpoint de listado. No basta con cambiar la URL.

### 5. Media: no hay acceso al historial administrativo completo

`GET /api/admin/audit-logs` admite `limit` y `offset`. El servicio frontend admite ambos argumentos, pero las pantallas no avanzan el offset. El dashboard aumenta el límite hasta 100 y la bandeja muestra los últimos 100 eventos. Los eventos anteriores siguen existiendo pero no son accesibles por esas vistas.

Referencias: `backend/src/controllers/admin.controller.js:201`, `frontend/src/services/adminService.js:29`, `frontend/src/pages/AdminDashboard/ConnectedAdminDashboard.jsx:173`, `frontend/src/pages/Notifications/AdminNotificationInbox.jsx:26`.

Pendiente: paginar el historial; mantener la campana como vista de novedades recientes.

### 6. Media: métricas recibidas que no se muestran

El reporte de almacenamiento devuelve `promedioPorUsuario`, `consumoGlobal.totalCarpetas` y listas de usuarios sobre cuota y próximos a cuota. La pantalla muestra algunos totales y distribuciones, pero no esos valores/listas. El resumen general también recibe `almacenamiento.promedioPorUsuarioGb` sin mostrarlo.

Referencias: `backend/src/services/report.service.js:523`, `backend/src/services/report.service.js:582`, `frontend/src/pages/AdminReports/AdminReports.jsx:103`, `frontend/src/pages/AdminReports/AdminReports.jsx:117`.

Pendiente: mostrar promedio y carpetas, y permitir consultar las cuentas que generan las alertas. Corregir primero el límite del hallazgo 2.

### 7. Media: notificaciones administrativas y personales usan modelos diferentes

La bandeja administrativa usa eventos de auditoría y almacena su lectura en localStorage. Las notificaciones personales usan `/api/notifications` y guardan la lectura en base de datos. La presentación es compartida, pero leer un evento administrativo no se sincroniza entre dispositivos. No hay endpoints específicos de lectura de auditoría administrativa en el backend actual.

Referencias: `frontend/src/pages/Notifications/AdminNotificationInbox.jsx:14`, `frontend/src/hooks/useAdminNotificationRead.js:6`, `backend/src/services/notification.service.js:40`.

Pendiente si se desea el mismo comportamiento: definir notificaciones administrativas persistentes o una tabla de lecturas por administrador. No convertir la eliminación de avisos en eliminación de auditoría.

### 8. Media: verificación y reenvío de correo no tienen interfaz propia

Existen `POST /api/auth/verify-email`, `GET /api/auth/verify` y la función de reenvío `resendEmailConfirmation`. No hay pantalla que consuma los endpoints de verificación ni botón de reenvío. El reenvío solo aparece expuesto en una ruta de pruebas de `/health`.

El correo actual verifica mediante un enlace directo a Supabase: la falta de pantalla no demuestra que el enlace normal esté roto. Sí falta una alternativa en la aplicación para ingresar un código, reintentar o pedir otro correo.

Referencias: `backend/src/routes/auth.routes.js:10`, `backend/src/controllers/authController.js:20`, `backend/src/routes/emailHook.routes.js`, `backend/src/routes/health.routes.js`, `frontend/src/pages/Register/Register.jsx:116`.

Pendiente: decidir si se necesita verificación manual y exponer un endpoint de reenvío de producción, con su interfaz.

## Endpoints sin consumidor directo: no todos son funciones faltantes

| Endpoint | Situación |
| --- | --- |
| `GET /api/admin/stats` | Sin llamada directa. El dashboard usa `/admin/overview` y métricas usa `/admin/reports/overview`; existe cobertura equivalente de parte de los indicadores. |
| `GET /api/admin/storage-metrics` | Sin llamada directa. Se usa `/admin/storage/overview` y el reporte de almacenamiento como alternativas. |
| `GET /api/admin/revenue` | Sin consumidor. A diferencia de las tablas agregadas del reporte, devuelve transacciones individuales; falta una vista administrativa de ese detalle si se requiere conciliación. |
| `POST /api/payments/process` | Sin consumidor directo. La UI procesa contratación, cambio y renovación mediante `/subscriptions/*`; no asumir que falta el pago del plan por no llamar esta ruta. |
| `GET /api/files/:id/download` | Sin consumidor directo. Se usa `/:id/download-url` como alternativa. |
| `GET /api/files/:id`, `GET /api/folders/:id` | Sin llamada directa localizada. Las vistas usan listados y contenido de carpetas. Son endpoints útiles para un detalle dedicado, pero no bloquean la navegación actual. |
| `/health/*` | Diagnóstico/pruebas. No requieren pantallas de producto. |
| `POST /api/hooks/send-auth-email` | Webhook para Supabase; no debe ser llamado por la interfaz. |

## Módulos con consumidores existentes

- Archivos y carpetas: listados, subidas, renombrar, mover, enviar a papelera y restaurar; eliminación permanente de archivos.
- Compartidos: enviar, recibidos/enviados, contenido de carpetas, descarga, detalle, permisos, revocación y búsqueda de destinatarios.
- Favoritos: listado, añadir y quitar archivos.
- Perfil, preferencias y seguridad: lectura/guardado, contraseña, sesiones y desactivación de cuenta.
- Planes administrativos: crear, consultar, editar y activar/desactivar.
- Suscripciones del usuario: actual, historial, contratar, cambiar, renovar y cancelar.
- Pagos del usuario: métodos, historial, detalle y comprobante con descarga.
- Actividad personal: fechas, acción y paginación.
- Notificaciones personales: listado, sin leer, marcar una/todas y eliminar.
- Administración: suscripciones paginadas, almacenamiento con filtro sobre cuota, reportes y exportaciones CSV/PDF.

## Funciones que también requieren backend

- Tickets de soporte: la pantalla es un centro de ayuda estático y no se localizaron rutas de tickets.
- Renovación de sesión: se guarda refreshToken, pero no se localizó un endpoint de refresh ni un consumidor que renueve automáticamente el access token. El token se usa para cerrar sesión.
- Subir/cambiar foto de perfil: se muestran avatares existentes, pero no se localizaron rutas para subir o modificar la foto desde CloudBox.

## Orden propuesto

1. Unificar URL de API y corregir cálculo/exportación truncados.
2. Conectar el acceso rápido a Mi plan.
3. Consumir usuarios y detalle mediante sus APIs; completar filtros necesarios.
4. Paginar auditoría e incorporar indicadores de almacenamiento ya disponibles.
5. Decidir persistencia de avisos administrativos, reenvío de correo, refresh de sesión y funciones nuevas de soporte/avatar.
