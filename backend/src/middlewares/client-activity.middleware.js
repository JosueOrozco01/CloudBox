const { recordLog } = require('../services/audit.service');

// Audit only completed operations. Authentication always runs before this middleware.
module.exports = function clientActivity({ action, entity, description }) {
  return (req, res, next) => {
    const sendJson = res.json.bind(res);
    const redirect = res.redirect.bind(res);
    let recorded = false;
    const record = async body => {
      if (recorded) return;
      recorded = true;
      const resource = body?.data || body || {};
      const id = (entity === 'archivo' ? resource.id_archivo : resource.id_carpeta) || req.params.id || resource.id;
      const name = resource.nombre || resource.name || (action === 'SUBIR_ARCHIVO' ? req.file?.originalname : null) || `${entity === 'archivo' ? 'Archivo' : 'Carpeta'} #${id}`;
      try {
        await recordLog({
          id_usuario: req.user.id,
          accion: action,
          entidad_afectada: entity,
          id_entidad_afectada: Number(id),
          ip_origen: req.ip,
          detalles: {
            resourceName: name,
            description,
            ...(resource.id_usuario_receptor ? { receiverUserId: resource.id_usuario_receptor } : {}),
            ...(resource.id_permiso ? { permissionId: resource.id_permiso } : {}),
          },
        });
      } catch (error) {
        // A logging outage must not turn a successful operation into a failure.
        console.error('Client activity could not be recorded:', error.message);
      }
    };
    res.json = async body => {
      if (res.statusCode >= 200 && res.statusCode < 300 && body?.success !== false) await record(body);
      return sendJson(body);
    };
    res.redirect = async (...args) => {
      const status = typeof args[0] === 'number' ? args[0] : 302;
      if (status >= 300 && status < 400) await record(null);
      return redirect(...args);
    };
    next();
  };
};
