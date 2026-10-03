const adminService = require('../services/admin.service');
const auditService = require('../services/audit.service');

const getAllUsers = async (req, res) => {
  try {
    const users = await adminService.getAllUsers();
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error interno del servidor', error: error.message });
  }
};

const updateUserStatus = async (req, res) => {
  const targetUserId = parseInt(req.params.id, 10);
  const { newStatusId } = req.body;
  const adminId = req.user?.id;

  if (isNaN(targetUserId) || !newStatusId) {
    return res.status(400).json({ success: false, message: 'Faltan parámetros o son inválidos' });
  }

  try {
    const updatedUser = await adminService.updateUserStatus(targetUserId, newStatusId);

    // Auditoría
    const ip_origen = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
    await auditService.recordLog({
      id_usuario: adminId,
      accion: 'CAMBIO_ESTADO_USUARIO',
      detalles: { targetUserId, newStatusId },
      ip_origen,
      entidad_afectada: 'usuario',
      id_entidad_afectada: targetUserId
    });

    res.status(200).json({ success: true, data: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error interno del servidor', error: error.message });
  }
};

const updateUserRole = async (req, res) => {
  const targetUserId = parseInt(req.params.id, 10);
  const { newRoleId } = req.body;
  const adminId = req.user?.id;

  if (isNaN(targetUserId) || !newRoleId) {
    return res.status(400).json({ success: false, message: 'Faltan parámetros o son inválidos' });
  }

  try {
    const updatedUser = await adminService.updateUserRole(targetUserId, newRoleId);

    // Auditoría
    const ip_origen = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
    await auditService.recordLog({
      id_usuario: adminId,
      accion: 'CAMBIO_ROL_USUARIO',
      detalles: { targetUserId, newRoleId },
      ip_origen,
      entidad_afectada: 'usuario',
      id_entidad_afectada: targetUserId
    });

    res.status(200).json({ success: true, data: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error interno del servidor', error: error.message });
  }
};

const getAuditLogs = async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 20;
  const offset = parseInt(req.query.offset, 10) || 0;

  try {
    const data = await adminService.getAuditLogs(limit, offset);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener bitácora', error: error.message });
  }
};

module.exports = {
  getAllUsers,
  updateUserStatus,
  updateUserRole,
  getAuditLogs
};
