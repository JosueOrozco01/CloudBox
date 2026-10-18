const labels = {
  SESION_INICIADA: "Inicio de sesión",
  SESION_CERRADA: "Sesión cerrada",
  OTRAS_SESIONES_CERRADAS: "Otras sesiones revocadas",
  CAMBIO_ESTADO_USUARIO: "Estado de usuario actualizado",
  CAMBIO_ROL_USUARIO: "Permisos de usuario actualizados",
  SUBIR_ARCHIVO: "Archivo subido",
  DESCARGAR_ARCHIVO: "Descarga autorizada",
  ELIMINAR_ARCHIVO: "Archivo eliminado",
  COMPARTIR_ARCHIVO: "Archivo compartido",
  COMPARTIR_CARPETA: "Carpeta compartida",
  ELIMINAR_CARPETA: "Carpeta eliminada",
  CREAR_CARPETA: "Carpeta creada",
  REGISTRO_USUARIO_ADMIN: "Usuario registrado",
};
export const activityLabel = log => labels[log.accion] || (log.accion || "Actividad registrada").replaceAll("_", " ").toLowerCase().replace(/^./, letter => letter.toUpperCase());
