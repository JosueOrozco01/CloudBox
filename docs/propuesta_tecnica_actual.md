# Propuesta Técnica: Capa de Presentación - Compartir Archivos (Fase 6)

## 1. Estructura del Controlador (`backend/src/controllers/share.controller.js`)

Se implementa el controlador `shareController` exponiendo la función asíncrona:
- `shareFile(req, res, next)`

### Responsabilidades y Reglas:
- **Extracción segura de identidad:** El identificador del emisor (`senderUserId`) se extrae directamente del objeto de autenticación (`req.user.id`), omitiendo cualquier valor enviado en `req.body` para garantizar integridad y prevenir suplantación.
- **Parámetros del cuerpo:** Extrae `receiverUserId`, `fileId`, `permissionId` y `expiresAt` de `req.body`.
- **Invocación del servicio:** Delega la lógica de negocio y validaciones a `ShareService.shareFile`.
- **Manejo de errores:** Captura excepciones y las delega al middleware global de errores mediante `next(error)`.
- **Retorno exitoso:** Retorna `201 Created` con payload estandarizado `{ success: true, data: result }`.

---

## 2. Firmas de Rutas (`backend/src/routes/share.routes.js`)

El router se configura con Express y se monta en `backend/src/app.js` bajo el prefijo `/api/shares`:

| Método | Ruta Relativa | Ruta Completa | Middleware | Acción en Controlador |
|---|---|---|---|---|
| `POST` | `/files` | `/api/shares/files` | `requireAuth` | `shareController.shareFile` |

### Especificación del Endpoint:
- **Headers Requeridos:**
  - `Authorization: Bearer <token_jwt>`
  - `Content-Type: application/json`
- **Request Body (JSON):**
  ```json
  {
    "receiverUserId": 10,
    "fileId": 25,
    "permissionId": 2,
    "expiresAt": "2026-12-31T23:59:59.000Z"
  }
  ```
- **Success Response (201 Created):**
  ```json
  {
    "success": true,
    "data": {
      "id": 1,
      "id_archivo": 25,
      "id_carpeta": null,
      "id_usuario_emisor": 1,
      "id_usuario_receptor": 10,
      "id_permiso": 2,
      "id_estado": 1,
      "fecha_compartido": "2026-10-14T19:00:00.000Z",
      "fecha_expiracion": "2026-12-31T23:59:59.000Z"
    }
  }
  ```

---

## 3. Códigos HTTP y Manejo de Respuestas

El controlador y servicio gestionan las siguientes respuestas HTTP:

| Código HTTP | Descripción | Casos de Error / Mensaje |
|---|---|---|
| **201 Created** | Compartido creado o reactivado con éxito | Operación exitosa |
| **400 Bad Request** | Parámetros inválidos o incompatibles | `CANNOT_SHARE_WITH_SELF`, `INVALID_PERMISSION`, `INVALID_EXPIRATION_DATE`, archivo no disponible (papelera) |
| **401 Unauthorized** | Error de autenticación | `AUTH_TOKEN_REQUIRED`, `INVALID_AUTH_FORMAT`, `INVALID_OR_EXPIRED_TOKEN` |
| **403 Forbidden** | Permisos insuficientes | `NOT_RESOURCE_OWNER` (el emisor no es el dueño del archivo) |
| **404 Not Found** | Recursos no encontrados o inactivos | `SENDER_NOT_FOUND`, `RECEIVER_NOT_FOUND`, `FILE_NOT_FOUND` |
| **409 Conflict** | Conflicto de estado | `SHARE_ALREADY_EXISTS` (archivo ya compartido activamente con el receptor) |
| **500 Internal Server Error** | Fallo interno o de persistencia | `INTERNAL_SERVER_ERROR`, `AUTH_VALIDATION_FAILED` |
