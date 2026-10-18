# Perfil, seguridad y preferencias

Las pestañas viven en `/perfil`, `/perfil?tab=seguridad` y `/perfil?tab=preferencias`, siempre dentro de la sesión. El botón Cambiar contraseña abre Seguridad; la recuperación pública sigue disponible desde el inicio de sesión. Entrar a `/recuperar` con sesión activa abre Seguridad.

Cookies, Privacidad y Términos conservan la barra de cuenta autenticada y omiten cabecera y footer públicos cuando existe una sesión válida. En visitas públicas conservan su presentación original. Los enlaces legales del footer usan navegación interna.

## Backend existente, sin migraciones

Las rutas requieren el middleware de autenticación y usan exclusivamente la identidad de la sesión:

- `GET /api/users/me/preferences`: preferencias de los metadatos de Supabase Auth.
- `PATCH /api/users/me/preferences`: tema claro/oscuro/sistema, español, visualización KB/MB y preferencias de avisos por correo; guarda `cloudbox_preferences` sin sustituir los demás metadatos.
- `GET /api/users/me/security`: sesión actual y accesos registrados por CloudBox, con navegador, sistema, IP y ubicación aproximada.
- `PATCH /api/users/me/password`: verifica contraseña actual y requisitos de la nueva; actualiza únicamente la cuenta autenticada, sin recuperación por correo ni navegación al login. La sesión temporal usada para verificar la contraseña se cierra con alcance local.
- `POST /api/users/me/logout-others`: revoca otras sesiones mediante el JWT actual y el alcance `others`. Los JWT ya emitidos pueden conservar validez hasta su vencimiento.

Cerrar sesión y Desactivar cuenta reutilizan las funciones existentes. Desactivar conserva archivos y datos; no se presenta como borrado permanente. Se corrigió la revocación para pasar el JWT a Supabase en lugar del UUID de usuario.

## Preferencias disponibles

El tema se aplica al guardar y al cargar la sesión; Sistema sigue el tema del dispositivo. Las unidades se aplican a Mis archivos, Mis favoritos y archivos recientes de Inicio. Las preferencias se conservan en la cuenta, con caché local para esa identidad.

Los interruptores de correo permiten guardar preferencias en la cuenta; aún no existe envío automático de esos avisos y se indica en la pantalla. Los idiomas sin traducción también están deshabilitados; actualmente se mantiene español. Estas opciones no simulan envíos ni traducciones. La campana sigue siendo exclusiva del administrador.

## Verificación

Pruebas de autorización de los ajustes, validación y verificación de contraseña, alcance de revocación, preservación de metadatos y limpieza de sesión temporal; compilación y ESLint de los archivos modificados. No se cambiaron contraseñas ni preferencias de cuentas reales en las pruebas. La comprobación visual y el flujo con cuentas reales quedan pendientes.


## Ajustes posteriores de sesiones, temas y avisos

El tema tiene vista previa inmediata al pulsar Claro/Oscuro/Sistema. Guardar preferencias conserva la elección en el backend; salir sin guardar restaura el tema guardado. Los interruptores de avisos ya son editables y persistentes; **guardar un aviso no envía correos**, porque el servicio de entrega sigue pendiente. La campana continúa siendo exclusiva del administrador.

Los nuevos inicios y cierres de sesión del backend se registran en `LogAuditoria`, sin tablas adicionales. Seguridad consulta solo registros del usuario autenticado; omite sesiones con acceso vencido y cierres conocidos por CloudBox. La sesión actual aparece aunque se haya iniciado antes de esta actualización. No se reconstruyen sesiones históricas ni se presenta este registro como una enumeración completa del estado interno de Supabase. Los cierres realizados desde servicios externos o tokens renovados fuera del flujo de CloudBox pueden no reflejarse inmediatamente.

Se obtiene ciudad y país aproximados con HTTPS a [ipwho.is](https://ipwhois.io/documentation), compartiendo únicamente la IP pública con ese proveedor. Hay caché de una hora, tiempo máximo de consulta de 2,5 segundos y manejo de errores; las IP privadas/locales nunca se consultan. En desarrollo con localhost se muestra Red local o privada. No se toma una cabecera reenviada arbitraria como IP real; detrás de un proxy la configuración de confianza deberá corresponder al despliegue. No se guardan tokens ni contraseñas en el registro.
