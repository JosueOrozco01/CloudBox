const AdminService = require('../services/admin.service');
const auditService = require('../services/audit.service');

const adminController = {
  async getAllUsers(req, res) {
    try {
      const users = await AdminService.getAllUsers();

      res.status(200).json({
        success: true,
        data: users
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  async updateUserStatus(req, res) {
    try {
      const targetUserId = parseInt(req.params.id, 10);
      const { id_estado } = req.body;
      const currentUserId = parseInt(req.user.id, 10);

      if (isNaN(targetUserId) || !id_estado) {
        return res.status(400).json({
          success: false,
          message: 'ID de usuario o estado inválido'
        });
      }

      // Evitar que el administrador suspenda su propia cuenta
      if (targetUserId === currentUserId) {
        return res.status(400).json({
          success: false,
          message: 'No puedes suspender tu propia cuenta'
        });
      }

      const newStatusId = parseInt(id_estado, 10);

      const updatedUser = await AdminService.updateUserStatus(
        targetUserId,
        newStatusId
      );

      // Registrar auditoría
      const ip_origen =
        req.headers['x-forwarded-for'] ||
        req.socket.remoteAddress ||
        req.ip;

      await auditService.recordLog({
        id_usuario: currentUserId,
        accion: 'CAMBIO_ESTADO_USUARIO',
        detalles: {
          targetUserId,
          newStatusId
        },
        ip_origen,
        entidad_afectada: 'usuario',
        id_entidad_afectada: targetUserId
      });

      res.status(200).json({
        success: true,
        data: updatedUser
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  async updateUserRole(req, res) {
    try {
      const targetUserId = parseInt(req.params.id, 10);
      const { id_rol } = req.body;
      const currentUserId = parseInt(req.user.id, 10);

      if (isNaN(targetUserId) || !id_rol) {
        return res.status(400).json({
          success: false,
          message: 'ID de usuario o rol inválido'
        });
      }

      // Evitar que el administrador cambie su propio rol
      if (targetUserId === currentUserId) {
        return res.status(400).json({
          success: false,
          message: 'No puedes degradar tus propios privilegios'
        });
      }

      const newRoleId = parseInt(id_rol, 10);

      const updatedUser = await AdminService.updateUserRole(
        targetUserId,
        newRoleId
      );

      // Registrar auditoría
      const ip_origen =
        req.headers['x-forwarded-for'] ||
        req.socket.remoteAddress ||
        req.ip;

      await auditService.recordLog({
        id_usuario: currentUserId,
        accion: 'CAMBIO_ROL_USUARIO',
        detalles: {
          targetUserId,
          newRoleId
        },
        ip_origen,
        entidad_afectada: 'usuario',
        id_entidad_afectada: targetUserId
      });

      res.status(200).json({
        success: true,
        data: updatedUser
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  async getAuditLogs(req, res) {
    try {
      const limit = parseInt(req.query.limit, 10) || 20;
      const offset = parseInt(req.query.offset, 10) || 0;

      const data = await AdminService.getAuditLogs(limit, offset);

      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener bitácora',
        error: error.message
      });
    }
  }
};

module.exports = adminController;