const guide = (title, ...steps) => ({ title, steps });
export const guides = {
  '/': guide('Bienvenido a CloudBox', 'Explora las características y los planes disponibles.', 'Crea una cuenta o inicia sesión para guardar y organizar tus archivos.'),
  '/login': guide('Iniciar sesión', 'Escribe tu correo y contraseña.', 'Si olvidaste tu contraseña, selecciona Recuperar contraseña.', 'Si aún no tienes cuenta, selecciona Registrarse.'),
  '/registro': guide('Crear una cuenta', 'Completa tus datos y elige una contraseña segura.', 'Acepta las condiciones y envía el formulario.', 'Revisa tu correo para verificar la cuenta antes de iniciar sesión.'),
  '/recuperar': guide('Recuperar acceso', 'Ingresa el correo de tu cuenta.', 'Revisa tu bandeja de entrada y sigue el enlace para cambiar la contraseña.'),
  '/verificar-correo': guide('Verificar correo', 'Abre el enlace de verificación que recibiste por correo.', 'Si no lo recibiste, revisa spam o solicita otro desde esta pantalla.'),
  '/dashboard': guide('Inicio', 'Consulta el espacio disponible y tu actividad reciente.', 'Usa Subir archivo para guardar un documento o Crear carpeta para organizarlo.', 'Abre Mis archivos para buscar, abrir o administrar tus documentos.'),
  '/archivos': guide('Mis archivos', 'Sube archivos o crea carpetas con los botones superiores.', 'Busca por nombre y usa los filtros o cambia entre lista y tarjetas.', 'Selecciona Abrir para ver el archivo. Usa Descargar para guardar una copia.', 'Usa las acciones del archivo para renombrar, mover, marcar como favorito o enviar a la papelera.'),
  '/archivos:favorites': guide('Mis favoritos', 'Aquí aparecen los archivos que marcaste con la estrella.', 'Selecciona Abrir para consultarlos o vuelve a tocar la estrella para quitarlos de favoritos.'),
  '/compartidos': guide('Compartidos conmigo', 'Consulta los archivos y carpetas que otras personas compartieron contigo.', 'Selecciona Abrir para consultar un archivo o explorar una carpeta. Las acciones disponibles dependen de tu permiso.', 'Usa Compartir para elegir un recurso, indicar el correo del destinatario y asignar un permiso.', 'Cambia a Compartidos por mí para revisar, modificar o revocar accesos que otorgaste.'),
  '/papelera': guide('Papelera', 'Aquí aparecen los archivos y carpetas que eliminaste.', 'Selecciona Restaurar para devolver un elemento a tus archivos.', 'Eliminar definitivamente es irreversible. Revisa el nombre antes de confirmar.'),
  '/perfil': guide('Mi perfil', 'Revisa o actualiza tu nombre y tu fotografía.', 'Guarda los cambios al terminar.', 'En Seguridad puedes cambiar la contraseña y consultar sesiones; en Preferencias puedes personalizar tu espacio.'),
  '/perfil:seguridad': guide('Seguridad', 'Completa los campos de contraseña actual y nueva para cambiarla.', 'Consulta las sesiones de tu cuenta y cierra las que no reconozcas.'),
  '/perfil:preferencias': guide('Preferencias', 'Elige el tema, idioma y las opciones de notificaciones.', 'Guarda tus preferencias para aplicarlas a tu cuenta.'),
  '/plan': guide('Mi plan', 'Compara el espacio, el precio y las condiciones de cada plan.', 'Selecciona el plan que necesitas y revisa el resumen antes de confirmar.', 'Consulta aquí el estado de tu suscripción.'),
  '/planes': guide('Planes disponibles', 'Compara los planes y su capacidad.', 'Inicia sesión o crea una cuenta para contratar el plan que necesitas.'),
  '/pagos': guide('Mis pagos', 'Consulta el estado y la fecha de tus pagos.', 'Abre un registro para ver su detalle o descargar el comprobante.', 'Usa los filtros y la paginación para encontrar un pago.'),
  '/actividad': guide('Mi actividad', 'Consulta las acciones registradas en tu cuenta.', 'Filtra por acción o fecha y avanza de página para ver registros anteriores.'),
  '/notificaciones': guide('Notificaciones', 'Abre un aviso para consultar su detalle.', 'Marca los avisos como leídos o elimina los que ya revisaste.'),
  '/soporte': guide('Centro de ayuda', 'Busca tu duda entre las preguntas frecuentes.', 'Si necesitas atención, abre Mis solicitudes y crea una solicitud con una descripción del problema.'),
  '/soporte/mis-solicitudes': guide('Mis solicitudes', 'Crea una solicitud indicando el asunto y lo que necesitas resolver.', 'Abre una solicitud para leer respuestas y continuar la conversación.', 'Cierra la solicitud cuando el problema esté resuelto.'),
  '/admin': guide('Panel de administración', 'Consulta los indicadores generales de usuarios, almacenamiento y suscripciones.', 'Usa la navegación para abrir el módulo que necesitas administrar.'),
  '/admin/usuarios': guide('Usuarios', 'Busca al usuario por nombre o correo.', 'Abre su detalle para revisar la cuenta y las acciones disponibles.', 'Revisa los datos antes de guardar cambios de estado o permisos.'),
  '/admin/planes': guide('Administrar planes', 'Revisa el catálogo y las condiciones de cada plan.', 'Crea o edita un plan y verifica capacidad, precio y estado antes de guardar.'),
  '/admin/suscripciones': guide('Suscripciones', 'Busca y filtra las suscripciones por estado o usuario.', 'Abre el detalle para revisar vigencia, plan y acciones disponibles.', 'Revisa el efecto de cada acción antes de confirmar.'),
  '/admin/almacenamiento': guide('Almacenamiento', 'Consulta el uso del espacio y la distribución por usuario.', 'Usa los filtros para localizar cuentas y revisar su consumo.'),
  '/admin/metricas': guide('Métricas y reportes', 'Selecciona el tipo de reporte y el período que deseas consultar.', 'Aplica los filtros y revisa los indicadores.', 'Usa CSV o PDF para exportar el reporte.'),
  '/admin/notificaciones': guide('Avisos administrativos', 'Abre los avisos para revisar su detalle.', 'Marca como leídos los que ya atendiste.'),
  '/admin/soporte': guide('Solicitudes de soporte', 'Filtra y abre las solicitudes pendientes.', 'Lee la conversación y envía una respuesta al usuario.', 'Actualiza el estado conforme avances y cierra la solicitud al resolverla.'),
};
guides['/admin/reportes'] = guides['/admin/metricas'];
for (const path of ['/sobre-nosotros', '/nosotros', '/caracteristicas', '/seguridad', '/terminos', '/privacidad', '/cookies']) {
  guides[path] = guide('Información de CloudBox', 'Lee la información de esta sección.', 'Usa la navegación para volver a tus archivos, consultar planes o visitar el centro de ayuda.');
}
const tourTargets = {
  '/': [['.landing-introduction'], ['.landing-introduction-actions']],
  '/login': [['.login-page .card'], ['.forgot'], ['.signup']],
  '/registro': [['.signup-card .field', '.signup-card'], ['.signup-card button[type="submit"]'], ['.signup-title']],
  '/recuperar': [['input[type="email"]'], ['button[type="submit"]']],
  '/verificar-correo': [['main h1', 'h1'], ['button[type="submit"]', 'form']],
  '/dashboard': [['.dash-stats'], ['.quick-actions-grid', '.dash-search'], ['.app-topbar-links a[href="/archivos"]', '.app-menu-toggle']],
  '/archivos': [['.mf-header-right'], ['.mf-search-actions'], ['.mf-open-btn', '.mf-table-wrap'], ['.mf-actions', '.mf-table-wrap']],
  '/archivos:favorites': [['.mf-library-favorites-banner'], ['.mf-actions', '.mf-table-wrap']],
  '/compartidos': [['.sc-scope-tabs'], ['.sc-open-btn', '.sc-table-wrap'], ['.sc-navigation-actions .sc-primary'], ['.sc-scope-tabs button:last-child']],
  '/papelera': [['.mf-trash-hero', '.mf-header'], ['.mf-restore-btn', '.mf-table-wrap'], ['.mf-trash-delete-btn', '.mf-table-wrap']],
  '/perfil': [['.profileFormGrid'], ['.profileFormActions'], ['.profileTabs']],
  '/perfil:seguridad': [['.sec-form'], ['.sec-session-list', '.sec-card:last-child']],
  '/perfil:preferencias': [['.account-theme-options', '.pref-card'], ['.pref-save-btn']],
  '/plan': [['.plans-catalog', '.plans-overview'], ['.plans-option button', '.plans-catalog'], ['.plans-current', '.plans-overview']],
  '/planes': [['.plans-catalog'], ['.plans-option button', '.plans-catalog']],
  '/pagos': [['.module-table-scroll', '.module-panel'], ['.module-table button', '.module-panel'], ['.module-filters', '.module-pager']],
  '/actividad': [['.activity-feed'], ['.activity-filter-panel']],
  '/notificaciones': [['.notification-card', '.notifications-empty'], ['.module-heading .module-actions']],
  '/soporte': [['.support-search', '.support-topics'], ['.support-heading-actions', 'a[href="/soporte/mis-solicitudes"]']],
  '/soporte/mis-solicitudes': [['.module-heading .primary'], ['.module-table-scroll', '.module-panel'], ['.module-filters']],
  '/admin': [['.admin-stats', '.admin-page'], ['.app-topbar-links', '.app-menu-toggle']],
  '/admin/usuarios': [['.um-search', '.um-filters'], ['.um-table-wrap', '.um-directory'], ['.um-table button', '.um-directory']],
  '/admin/planes': [['.ap-grid'], ['.module-heading .primary', '.module-heading']],
  '/admin/suscripciones': [['.as-toolbar'], ['.module-table-scroll', '.as-directory'], ['.as-note']],
  '/admin/almacenamiento': [['.ast-stats'], ['.ast-toolbar']],
  '/admin/metricas': [['.ar-filter-panel'], ['.module-stats', '.module-panel'], ['.module-heading .module-actions']],
  '/admin/reportes': [['.ar-filter-panel'], ['.module-stats', '.module-panel'], ['.module-heading .module-actions']],
  '/admin/notificaciones': [['.notification-card', '.notifications-empty'], ['.module-heading .module-actions']],
  '/admin/soporte': [['.module-filters'], ['.module-table-scroll', '.module-panel'], ['.module-panel']],
};
const tourTitles = {
  '/archivos': ['Todo empieza con un archivo', 'Encuentra lo que necesitas', 'Abre y consulta', 'Organiza a tu manera'],
  '/compartidos': ['Un espacio para colaborar', 'Explora los recursos', 'Comparte tu primera idea', 'Tú controlas los accesos'],
  '/papelera': ['Un lugar para recuperar', 'Dale una segunda oportunidad', 'Revisa antes de eliminar'],
  '/perfil': ['Hazlo tuyo', 'Guarda tus cambios', 'Un espacio a tu manera'],
  '/perfil:seguridad': ['Cuida tu contraseña', 'Revisa tus sesiones'],
  '/perfil:preferencias': ['Tu espacio, tu estilo', 'Conserva tus preferencias'],
};

export function getTourSteps(guide) {
  return guide.steps.map((text, index) => ({
    text,
    title: guide.stepTitles?.[index] || ['Empieza por aquí', 'Explora tus opciones', 'Da el siguiente paso', 'Todo bajo control'][index % 4],
    targets: [...(guide.targets?.[index] || []), '.module-heading', '.profilePageHeader', 'main h1', 'h1'],
  }));
}

export function getPageGuide(pathname, search = '') {
  const params = new URLSearchParams(search);
  const section = pathname === '/perfil' ? params.get('tab') : pathname === '/archivos' && params.get('favorites') === '1' ? 'favorites' : null;
  const key = guides[`${pathname}:${section}`] ? `${pathname}:${section}` : guides[pathname] ? pathname : '/';
  return { ...guides[key], targets: tourTargets[key], stepTitles: tourTitles[key] };
}
