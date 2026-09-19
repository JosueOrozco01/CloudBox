# Convenciones de Desarrollo - CloudBox

## Nombres de archivos

Los componentes React utilizarán PascalCase:

UserCard.jsx
FileCard.jsx
Sidebar.jsx

Los servicios utilizarán camelCase:

authService.js
fileService.js
paymentService.js

Los controladores utilizarán camelCase:

userController.js
fileController.js
paymentController.js

## Componentes

Los componentes reutilizables deben almacenarse en:

frontend/src/components/

## Páginas

Las páginas principales deben almacenarse en:

frontend/src/pages/

## Servicios

Las peticiones al backend deben almacenarse en:

frontend/src/services/

## Backend

Los controladores deben almacenarse en:

backend/src/controllers/

Los modelos deben almacenarse en:

backend/src/models/

Las rutas deben almacenarse en:

backend/src/routes/

Los middlewares deben almacenarse en:

backend/src/middlewares/

## Git

Cada integrante debe trabajar en su propia rama.

No realizar cambios directamente en main.

Antes de realizar un Pull Request:

- Verificar que el proyecto compile.
- Verificar que no existan errores.
- Revisar el código.
- Probar la funcionalidad implementada.

Los commits deben describir claramente qué se realizó.