# Propuesta Técnica: Bitácora de Auditoría

## 1. Servicio de Auditoría (`backend/src/services/audit.service.js`)
- Se implementará la función `recordLog({ id_usuario, accion, detalles, ip_origen })` en sintaxis CommonJS.
- Se utilizará `supabaseAdmin` para insertar el registro en la tabla `LogAuditoria`, evadiendo las políticas de seguridad a nivel de fila (RLS).
- Los errores de inserción se capturarán de forma silenciosa con `console.error` para evitar bloquear el flujo principal (ej. suspensión o cambio de rol).

## 2. Integración en Administración (`backend/src/controllers/admin.controller.js`)
- **Cambio de Estado:** Tras actualizar el estado con éxito (`updateUserStatus`), se llamará a `recordLog` registrando la acción `CAMBIO_ESTADO_USUARIO`, los detalles (`targetUserId`, `newStatusId`, `previousStatusId`) y el `id_usuario` (`req.user.id`).
- **Cambio de Rol:** Tras actualizar el rol con éxito (`updateUserRole`), se llamará a `recordLog` registrando la acción `CAMBIO_ROL_USUARIO`, detalles (`targetUserId`, `newRoleId`) y el `id_usuario`.

## 3. Endpoint de Consulta de Auditoría (`backend/src/routes/admin.routes.js` y `admin.controller.js`)
- Controlador: Implementar `getAuditLogs(req, res)` que consulte la tabla `LogAuditoria`, ordene por `fecha` descendente y maneje paginación básica (ej. `limit` y `offset` de Supabase).
- Rutas: Añadir `GET /audit-logs` al enrutador `admin.routes.js` protegido por `requireAuth` y `authorizeRole(['Administrador'])`.
