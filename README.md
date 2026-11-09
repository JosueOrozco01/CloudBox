# CloudBox

Proyecto universitario de almacenamiento de archivos. Incluye un frontend React/Vite, una API Express y Supabase para autenticación, PostgreSQL y objetos de Storage. Los pagos son simulados.

## Preparación

Utilizar Node.js 24 LTS y npm. Desde la raíz:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
npm --prefix backend ci
npm --prefix frontend ci
```

Completar las variables de ambos archivos. El backend necesita URL, clave anónima y una clave privilegiada de Supabase. La clave privilegiada pertenece exclusivamente al backend. `VITE_API_URL` debe apuntar al backend; admite una URL con o sin el sufijo `/api`.

Configurar `CORS_ORIGINS` con los orígenes exactos del frontend, separados por comas. En producción es obligatorio. Definir `TRUST_PROXY` según el proxy controlado del despliegue; no confiar en encabezados de origen arbitrarios. La plantilla contiene las variables de redirección y del proveedor de correo utilizado por el hook existente.

## Base de datos

La instalación requiere el modelo final aprobado por el equipo y las migraciones comerciales, de seguridad y notificaciones correspondientes. Los archivos históricos de inspección, rollback y respaldos no son instrucciones para ejecutarlos en bloque.

Esta rama incorpora `supabase/migrations/20261103000000_fix_audit_consistency.sql`. Debe instalarse antes de publicar el código de esta rama. Reconcilia soporte y lecturas administrativas, añade seguimiento de borrado físico y aplica invariantes de cuota, carpetas y notificaciones. La instalación remota no se realiza al iniciar la aplicación.

Comprobar la instalación sin modificar registros:

```powershell
node --env-file=backend/.env backend/scripts/check-integrations.js
node --env-file=backend/.env backend/scripts/smoke-admin-integrations.js
```

## Desarrollo

Ejecutar en dos terminales:

```powershell
npm --prefix backend run dev
npm --prefix frontend run dev
```

El backend usa el puerto 3000 por defecto. La comprobación pública de salud está en `/health` y no modifica cuentas ni envía mensajes.

## Validación

```powershell
npm --prefix backend test
npm --prefix frontend run lint
npm --prefix frontend test
npm --prefix frontend run build
```

Las pruebas del backend incluyen PostgreSQL embebido de PGlite con una base temporal independiente. No necesitan credenciales ni modifican Supabase. Las pruebas visuales usan Chromium y una API simulada:

```powershell
Set-Location frontend
npx playwright install chromium
npm run test:ui
```

El ejecutor visual compila la aplicación, inicia un servidor de vista previa y un navegador aislado, y libera ambos al finalizar. En Linux, instalar las dependencias del navegador con `npx playwright install --with-deps chromium`. GitHub Actions ejecuta pruebas, compilación, análisis estático y auditoría npm.

## Publicación y recuperación

Servir `frontend/dist` mediante un servidor estático con redirección de rutas a `index.html`. Ejecutar el backend con `npm start` desde `backend`, después de configurar sus variables y aplicar las migraciones requeridas. Comprobar autenticación, carga, descarga, compartidos y un pago simulado con cuentas de prueba del entorno publicado.

Los archivos con borrado físico no confirmado continúan consumiendo cuota y se muestran como pendientes. Para inspeccionar el trabajo de limpieza desde `backend`:

```powershell
node scripts/reconcile-storage-deletions.js
```

Para procesar los pendientes ya registrados, utilizar `node scripts/reconcile-storage-deletions.js --apply`. Programar este comando con la infraestructura del despliegue cuando se requiera limpieza automática. No elimina archivos activos. También reintenta limpiar objetos de cargas cuya escritura en base falló.

Mantener respaldos de la base y de Storage, y comprobar su restauración conjunta. El informe de la rama detalla las correcciones y las validaciones realizadas en `docs/FIX_PROBLEMS_2026-11-03.md`.
