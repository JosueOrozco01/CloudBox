# Integración de nuevos módulos — 30 de octubre de 2026

## Páginas entregadas

| Ruta | Funciones |
| --- | --- |
| `/planes` | Catálogo público de planes activos con precio, capacidad y vigencia. |
| `/plan` | Suscripción actual, cuota, historial, contratación, cambio de plan, renovación y cancelación. Presenta las fechas efectivas y créditos que devuelve el backend. |
| `/pagos` | Historial y detalle de pagos simulados, consulta de comprobantes y descarga PDF. Comprobantes habilitados para pagos aprobados. |
| `/actividad` | Historial personal paginado con filtros por acción y fechas. |
| `/notificaciones` | Bandeja paginada, filtro sin leer, lectura individual/global y eliminación con confirmación. |
| `/soporte` | Centro de ayuda de uso. No simula envío de tickets: no existe ese servicio en backend. |
| `/admin/planes` | Catálogo completo, búsqueda, creación, edición y activación/desactivación. |
| `/admin/suscripciones` | Consulta paginada, filtro por estado y vigencias. |
| `/admin/almacenamiento` | Consumo global y por usuario, paginación y filtro de usuarios sobre cuota. |
| `/admin/metricas` y `/admin/reportes` | Reportes generales, de usuarios, suscripciones, ingresos y almacenamiento, con fechas y exportación CSV/PDF. |

Las rutas privadas conservan `AuthenticatedPage` y sus permisos. La navegación, los accesos del dashboard y los botones de ampliar espacio ya abren las nuevas páginas. La campana del cliente consulta notificaciones personales; la campana administrativa conserva su fuente de auditoría. Mi actividad y Notificaciones también están disponibles en el menú de cuenta.

Papelera ofrece eliminar permanentemente **archivos**, previa confirmación, mediante la API existente. No se añade borrado permanente de carpetas ni vaciado masivo.

## Arquitectura

- React/Vite y React Router existentes; no se agregaron dependencias.
- Páginas en `frontend/src/pages`, elementos visuales reutilizables en `components/ModuleUI`, campana en `components/ClientNotifications`.
- Servicios separados: `planService`, `subscriptionService`, `paymentService`, `activityService`, `notificationService`, `reportService` y ampliación de `adminService`.
- `apiClient` reutiliza la normalización de `VITE_API_URL`, autentica con el token existente, conserva la envoltura de paginación y admite respuestas HTTP 204.
- `hooks/useResource` evita presentar respuestas antiguas al cambiar filtros o página. No actualiza el componente tras desmontarse.
- Estilos limitados a las clases de los módulos, con variables de tema existentes, diseño adaptable, tablas con desplazamiento interno y modales con control de foco/Escape.

La única extensión de backend es `GET /api/plans/admin/all`, autenticada y exclusiva de Administrador. Permite gestionar planes inactivos sin exponerlos en el catálogo público. Sigue la separación de rutas, controlador y servicio. No requiere tablas ni migraciones nuevas.

## Comportamiento comercial

La contratación usa `/subscriptions/subscribe`; el cambio de plan usa `/subscriptions/change-plan`; la renovación usa `/subscriptions/renew`. No se emite un pago independiente que pueda cobrar sin completar el cambio de suscripción. Los cálculos y las reglas comerciales permanecen en el backend.

La interfaz genera una referencia para cada operación y la conserva durante los errores. Un rechazo confirmado permite preparar un nuevo intento explícito. Un error de servidor pide consultar el historial antes de reintentar. No se permite contratar si falla la consulta de la suscripción actual. Los cambios programados y el crédito se presentan según la respuesta real, sin asumir que toda operación es inmediata. Los pagos siguen siendo simulados.

## Validación

- Compilación de producción con `npm run build` en frontend.
- ESLint sobre todos los archivos de frontend modificados.
- 16 pruebas seleccionadas aprobadas: `admin-plan-catalog.test.js`, `subscription-checkout.test.js`, `subscription-lifecycle.test.js` y `notifications-stage3.test.js` en `backend/tests`.
- Prueba en navegador Edge con API interceptada: `frontend/scripts/modules-ui.test.mjs`. Cubre 12 rutas, contratación, cambio de plan, renovación, cancelación programada, rechazo, detalle/descarga de comprobantes, exportación CSV/PDF, actividad filtrada, lectura/borrado HTTP 204 de notificaciones, protección cuando falla la consulta de suscripción, creación/edición/activación de planes, filtro de cuota y confirmación de borrado permanente. Comprueba ausencia de errores no controlados y de desbordamiento móvil; se inspeccionaron capturas de escritorio y tema oscuro móvil.

Para repetir la prueba de navegador, iniciar Vite en `127.0.0.1:5178` y Chromium/Edge con un **perfil temporal independiente** y depuración remota en `127.0.0.1:9238`, luego ejecutar `node frontend/scripts/modules-ui.test.mjs`. Se pueden cambiar las direcciones mediante `UI_TEST_ORIGIN` y `UI_TEST_BROWSER`. La prueba intercepta las solicitudes `/api/` y no utiliza cuentas ni datos reales. No conectarla a una sesión de navegador personal.

Tres pruebas administrativas anteriores (`backend/scripts/admin-fase8-adm.test.js`, `admin-fase8-rep.test.js` y `admin-fase8-sto.test.js`) fallan al cargar sus mocks: `Cannot find module './commercial-policy'`. Esos scripts no fueron modificados en esta entrega.

## Límite de la entrega

Se implementó y verificó la integración local con respuestas simuladas y pruebas aisladas. No se ejecutó SQL, no se modificaron datos reales y no se publicó el proyecto. La validación integral con Supabase sigue pendiente del despliegue coordinado y de los SQL comerciales/de notificaciones descritos en la documentación de backend.


## Unificación visual

Las páginas nuevas usan Manrope y Outfit, el azul principal #2563ff, el acento #1565c0, los fondos y bordes de la aplicación y los mismos colores de estado de Usuarios. Los modales reutilizan las clases cf-backdrop/cf-modal/cf-header/cf-body, conservando foco, Escape y bloqueo de acciones durante solicitudes. Los estilos de tema oscuro siguen la paleta existente.

La campana del cliente ahora despliega una bandeja con las mismas clases y distribución visual de AdminNotifications: contador, estados sin leer, marcar todas, detalle en modal y cierre exterior/Escape. La lectura se guarda en la API personal de notificaciones y la bandeja completa sigue disponible mediante su enlace. Se verificaron el desplegable, lectura individual/global, detalle, cierre con Escape y adaptación móvil con datos simulados.
