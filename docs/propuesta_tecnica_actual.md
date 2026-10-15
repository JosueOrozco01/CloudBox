# Propuesta Técnica: Parte 3 - Consultas y Administración de Compartidos (Fase 6)

Esta propuesta cubre los requerimientos técnicos de las Secciones 5, 10, 11, 12, 13 y 15 del documento `CloudBox_Fase6_Benja_Compartir`, correspondientes a la tarjeta **"Backend - API para compartir archivos - Benja"**.

---

## 1. Diseño de la Capa de Servicio (`backend/src/services/share.service.js`)

Se implementarán las 5 funciones clave de consulta y administración sobre la tabla `compartir`:

### 1.1 `getSharedByUser(userId)`
- **Propósito:** Retornar los recursos que el usuario autenticado ha compartido con otros usuarios.
- **Reglas de Negocio:**
  - Filtra por `id_usuario_emisor = userId` y `id_estado = 1` (Activo).
  - Incluye relación con el recurso (`archivo`: id, nombre, peso, extension, mimetype, id_estado) y con el destinatario (`usuario` receptor: id, nombre, apellido, correo).
  - Incluye datos del permiso (`permiso`: id, nombre).

### 1.2 `getSharedFilesWithUser(userId)`
- **Propósito:** Retornar los archivos compartidos directamente con el usuario autenticado.
- **Reglas de Negocio:**
  - Filtra por `id_usuario_receptor = userId`, `id_archivo IS NOT NULL` y `id_estado = 1` (Activo).
  - **Expiración dinámica (Sección 11):** Filtra o excluye registros cuya `fecha_expiracion` no sea nula y sea menor o igual a la fecha actual (`fecha_expiracion > NOW() OR fecha_expiracion IS NULL`).
  - **Disponibilidad de archivo (Sección 14):** Solo retorna compartidos cuyo archivo asociado tenga `id_estado = 1` (Activo; excluye archivos en papelera o eliminados).
  - Incluye datos del archivo y del emisor (`usuario` emisor: id, nombre, apellido, correo), además del permiso.

### 1.3 `getShareById({ shareId, userId })`
- **Propósito:** Consultar el detalle de un compartido específico por su ID.
- **Reglas de Negocio:**
  - Si el registro no existe en `compartir`: retorna `404 Not Found` (`SHARE_NOT_FOUND`).
  - **Control de Acceso (Sección 6):** Valida que `userId` sea estrictamente el emisor (`id_usuario_emisor`) o el receptor (`id_usuario_receptor`). Si es un tercero, retorna `403 Forbidden` (`ACCESS_DENIED`).
  - Retorna el registro enriquecido con datos del archivo, emisor, receptor y permiso.

### 1.4 `changePermission({ shareId, actorUserId, permissionId })`
- **Propósito:** Modificar el nivel de acceso (Editor ↔ Visualizador) de un recurso compartido.
- **Reglas de Negocio:**
  - Valida que `permissionId` sea un número válido perteneciente a `[1, 2]` (`PERMISSIONS.EDITOR`, `PERMISSIONS.VIEWER`). En caso contrario, retorna `400 Bad Request` (`INVALID_PERMISSION`).
  - Consulta el compartido. Si no existe: `404 Not Found` (`SHARE_NOT_FOUND`).
  - **Propiedad (Sección 13):** Solo el propietario/emisor original (`id_usuario_emisor === actorUserId`) puede alterar permisos. Si no coincide, retorna `403 Forbidden` (`NOT_RESOURCE_OWNER`).
  - Si el compartido está revocado (`id_estado === 2`), retorna `400 Bad Request` (`SHARE_REVOKED`).
  - Actualiza `id_permiso = permissionId` y retorna el registro actualizado.

### 1.5 `revokeShare({ shareId, actorUserId })`
- **Propósito:** Revocar el acceso a un recurso compartido.
- **Reglas de Negocio (Sección 12):**
  - No elimina el registro físicamente; actualiza el estado a `id_estado = 2` (Revocado).
  - Consulta el compartido. Si no existe: `404 Not Found` (`SHARE_NOT_FOUND`).
  - **Propiedad (Sección 12):** Solo el emisor original (`id_usuario_emisor === actorUserId`) puede revocar el compartido. Si no coincide, retorna `403 Forbidden` (`NOT_RESOURCE_OWNER`).
  - Retorna el registro actualizado con estado revocado.

---

## 2. Controlador (`backend/src/controllers/share.controller.js`)

Todos los métodos extraen la identidad del usuario directamente desde el token (`req.user.id`), protegiendo la API contra suplantaciones.

- `getSharedByUser(req, res, next)`: Ejecuta `ShareService.getSharedByUser(req.user.id)` y retorna `200 OK` con `{ success: true, data }`.
- `getSharedFilesWithUser(req, res, next)`: Ejecuta `ShareService.getSharedFilesWithUser(req.user.id)` y retorna `200 OK` con `{ success: true, data }`.
- `getShareById(req, res, next)`: Extrae `shareId` de `req.params.id`, ejecuta `ShareService.getShareById({ shareId, userId: req.user.id })` y retorna `200 OK` con `{ success: true, data }`.
- `changePermission(req, res, next)`: Extrae `shareId` de `req.params.id` y `permissionId` de `req.body`, ejecuta `ShareService.changePermission({ shareId, actorUserId: req.user.id, permissionId })` y retorna `200 OK` con `{ success: true, data }`.
- `revokeShare(req, res, next)`: Extrae `shareId` de `req.params.id`, ejecuta `ShareService.revokeShare({ shareId, actorUserId: req.user.id })` y retorna `200 OK` con `{ success: true, data }`.
- **Manejo de Excepciones:** Todos los métodos delegan errores al middleware global mediante `next(error)`.

---

## 3. Firmas de Rutas (`backend/src/routes/share.routes.js`)

Se mantiene el router con `router.use(requireAuth)`. Para evitar colisiones en Express donde `/:id` capture rutas literales, se definen en el siguiente orden estricto:

| Método | Ruta | Middleware | Controlador | Descripción |
|---|---|---|---|---|
| `POST` | `/api/shares/files` | `requireAuth` | `shareController.shareFile` | Compartir archivo (Parte 1 y 2) |
| `GET` | `/api/shares/sent` | `requireAuth` | `shareController.getSharedByUser` | Listar compartidos salientes |
| `GET` | `/api/shares/received/files` | `requireAuth` | `shareController.getSharedFilesWithUser` | Listar archivos recibidos activos |
| `GET` | `/api/shares/:id` | `requireAuth` | `shareController.getShareById` | Detalle de un compartir por ID |
| `PATCH` | `/api/shares/:id/permission` | `requireAuth` | `shareController.changePermission` | Actualizar permiso (Editor/Viewer) |
| `PATCH` | `/api/shares/:id/revoke` | `requireAuth` | `shareController.revokeShare` | Revocar acceso a un recurso |

---

## 4. Contratos de Entrada / Salida (Request & Response)

### 4.1 `GET /api/shares/sent`
- **Headers:** `Authorization: Bearer <token>`
- **Response 200 OK:**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 1,
        "id_archivo": 25,
        "id_carpeta": null,
        "id_usuario_emisor": 2,
        "id_usuario_receptor": 5,
        "id_permiso": 2,
        "id_estado": 1,
        "fecha_compartido": "2026-10-14T20:00:00.000Z",
        "fecha_expiracion": null,
        "archivo": {
          "id": 25,
          "nombre": "documento.pdf",
          "peso": 1048576,
          "extension": "pdf",
          "mimetype": "application/pdf"
        },
        "receptor": {
          "id": 5,
          "nombre": "Ana",
          "apellido": "López",
          "correo": "ana@example.com"
        },
        "permiso": {
          "id": 2,
          "nombre": "Visualizador"
        }
      }
    ]
  }
  ```

### 4.2 `GET /api/shares/received/files`
- **Headers:** `Authorization: Bearer <token>`
- **Response 200 OK:**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 1,
        "id_archivo": 25,
        "id_usuario_emisor": 2,
        "id_usuario_receptor": 5,
        "id_permiso": 1,
        "id_estado": 1,
        "fecha_compartido": "2026-10-14T20:00:00.000Z",
        "fecha_expiracion": "2026-12-31T23:59:59.000Z",
        "archivo": {
          "id": 25,
          "nombre": "documento.pdf",
          "peso": 1048576,
          "extension": "pdf",
          "mimetype": "application/pdf"
        },
        "emisor": {
          "id": 2,
          "nombre": "Carlos",
          "apellido": "Pérez",
          "correo": "carlos@example.com"
        },
        "permiso": {
          "id": 1,
          "nombre": "Editor"
        }
      }
    ]
  }
  ```

### 4.3 `GET /api/shares/:id`
- **Headers:** `Authorization: Bearer <token>`
- **Response 200 OK:**
  ```json
  {
    "success": true,
    "data": {
      "id": 1,
      "id_archivo": 25,
      "id_carpeta": null,
      "id_usuario_emisor": 2,
      "id_usuario_receptor": 5,
      "id_permiso": 2,
      "id_estado": 1,
      "fecha_compartido": "2026-10-14T20:00:00.000Z",
      "fecha_expiracion": null,
      "archivo": {
        "id": 25,
        "nombre": "documento.pdf"
      },
      "emisor": {
        "id": 2,
        "nombre": "Carlos",
        "correo": "carlos@example.com"
      },
      "receptor": {
        "id": 5,
        "nombre": "Ana",
        "correo": "ana@example.com"
      },
      "permiso": {
        "id": 2,
        "nombre": "Visualizador"
      }
    }
  }
  ```

### 4.4 `PATCH /api/shares/:id/permission`
- **Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "permissionId": 1
  }
  ```
- **Response 200 OK:**
  ```json
  {
    "success": true,
    "data": {
      "id": 1,
      "id_permiso": 1,
      "id_estado": 1
    }
  }
  ```

### 4.5 `PATCH /api/shares/:id/revoke`
- **Headers:** `Authorization: Bearer <token>`
- **Response 200 OK:**
  ```json
  {
    "success": true,
    "data": {
      "id": 1,
      "id_estado": 2
    }
  }
  ```

---

## 5. Matriz de Códigos HTTP y Errores

| Código HTTP | Error Code | Causa |
|---|---|---|
| **200 OK** | *(N/A)* | Consulta o actualización exitosa. |
| **400 Bad Request** | `INVALID_PERMISSION` | `permissionId` no es 1 (Editor) ni 2 (Visualizador). |
| **400 Bad Request** | `SHARE_REVOKED` | Intento de cambiar permiso a un recurso ya revocado. |
| **400 Bad Request** | `INVALID_EXPIRATION_DATE` | Formato inválido o fecha de expiración pasada. |
| **401 Unauthorized** | `AUTH_TOKEN_REQUIRED` / `INVALID_OR_EXPIRED_TOKEN` | Token no provisto o inválido. |
| **403 Forbidden** | `NOT_RESOURCE_OWNER` | Usuario intenta cambiar permiso o revocar sin ser el emisor/propietario. |
| **403 Forbidden** | `ACCESS_DENIED` | Tercero intenta consultar un recurso que no le pertenece ni le fue compartido. |
| **404 Not Found** | `SHARE_NOT_FOUND` | El ID del compartido no existe en el sistema. |
| **500 Internal Error**| `INTERNAL_SERVER_ERROR` | Fallo de conexión o error no controlado en base de datos. |
