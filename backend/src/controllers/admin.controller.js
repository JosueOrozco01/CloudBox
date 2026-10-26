const AdminService = require("../services/admin.service");
const auditService = require("../services/audit.service");

const adminController = {
  async getOverview(req, res) {
    try {
      res.json({ success: true, data: await AdminService.getOverview() });
    } catch (error) {
      res
        .status(error.status || 500)
        .json({ success: false, message: error.message });
    }
  },
  async getAllUsers(req, res) {
    try {
      const users = await AdminService.getAllUsers();

      res.status(200).json({
        success: true,
        data: users,
      });
    } catch (error) {
      res.status(error.status || 500).json({
        success: false,
        message: error.message,
      });
    }
  },

  async updateUserStatus(req, res) {
    try {
      const targetUserId = Number(req.params.id);
      const { id_estado } = req.body;
      const currentUserId = parseInt(req.user.id, 10);

      if (isNaN(targetUserId) || !id_estado) {
        return res.status(400).json({
          success: false,
          message: "ID de usuario o estado inválido",
        });
      }

      // Evitar que el administrador suspenda su propia cuenta
      if (targetUserId === currentUserId) {
        return res.status(400).json({
          success: false,
          message: "No puedes suspender tu propia cuenta",
        });
      }

      const newStatusId = Number(id_estado);

      const updatedUser = await AdminService.updateUserStatus(
        targetUserId,
        newStatusId,
      );

      // Registrar auditoría
      const ip_origen =
        req.headers["x-forwarded-for"] || req.socket.remoteAddress || req.ip;

      await auditService.recordLog({
        id_usuario: currentUserId,
        accion: "CAMBIO_ESTADO_USUARIO",
        detalles: {
          targetUserId,
          newStatusId,
        },
        ip_origen,
        entidad_afectada: "usuario",
        id_entidad_afectada: targetUserId,
      });

      res.status(200).json({
        success: true,
        data: updatedUser,
      });
    } catch (error) {
      res.status(error.status || 500).json({
        success: false,
        message: error.message,
      });
    }
  },

  async updateUserRole(req, res) {
    try {
      const targetUserId = Number(req.params.id);
      const { id_rol } = req.body;
      const currentUserId = parseInt(req.user.id, 10);

      if (isNaN(targetUserId) || !id_rol) {
        return res.status(400).json({
          success: false,
          message: "ID de usuario o rol inválido",
        });
      }

      // Evitar que el administrador cambie su propio rol
      if (targetUserId === currentUserId) {
        return res.status(400).json({
          success: false,
          message: "No puedes degradar tus propios privilegios",
        });
      }

      const newRoleId = Number(id_rol);

      const updatedUser = await AdminService.updateUserRole(
        targetUserId,
        newRoleId,
      );

      // Registrar auditoría
      const ip_origen =
        req.headers["x-forwarded-for"] || req.socket.remoteAddress || req.ip;

      await auditService.recordLog({
        id_usuario: currentUserId,
        accion: "CAMBIO_ROL_USUARIO",
        detalles: {
          targetUserId,
          newRoleId,
        },
        ip_origen,
        entidad_afectada: "usuario",
        id_entidad_afectada: targetUserId,
      });

      res.status(200).json({
        success: true,
        data: updatedUser,
      });
    } catch (error) {
      res.status(error.status || 500).json({
        success: false,
        message: error.message,
      });
    }
  },

  async getAuditLogs(req, res) {
    try {
      const limit = Math.min(
        200,
        Math.max(1, parseInt(req.query.limit, 10) || 20),
      );
      const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

      const data = await AdminService.getAuditLogs(limit, offset);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      res.status(error.status || 500).json({
        success: false,
        message: "Error al obtener bitácora",
        error: error.message,
      });
    }
  },

  // ==========================================
  // EXTENSIONES FASE 7 - CONTROLADOR ADMIN
  // ==========================================

  async getStats(req, res, next) {
    try {
      const stats = await AdminService.getGeneralStats();
      return res.status(200).json({
        success: true,
        message: 'Estadísticas globales obtenidas exitosamente',
        data: stats
      });
    } catch (error) {
      next(error);
    }
  },

  async getUsers(req, res, next) {
    try {
      const result = await AdminService.getUsersList(req.query);
      return res.status(200).json({
        success: true,
        message: 'Usuarios obtenidos exitosamente',
        data: result.users,
        pagination: result.pagination
      });
    } catch (error) {
      next(error);
    }
  },

  async getStorageMetrics(req, res, next) {
    try {
      const metrics = await AdminService.getStorageMetrics();
      return res.status(200).json({
        success: true,
        message: 'Métricas de almacenamiento obtenidas exitosamente',
        data: metrics
      });
    } catch (error) {
      next(error);
    }
  },

  async getSubscriptions(req, res, next) {
    try {
      const result = await AdminService.getAllSubscriptions(req.query);
      return res.status(200).json({
        success: true,
        message: 'Suscripciones obtenidas exitosamente',
        data: result.subscriptions,
        pagination: result.pagination
      });
    } catch (error) {
      next(error);
    }
  },

  async getRevenue(req, res, next) {
    try {
      const { startDate, endDate } = req.query;
      const report = await AdminService.getRevenueReport({ startDate, endDate });
      return res.status(200).json({
        success: true,
        message: 'Reporte financiero obtenido exitosamente',
        data: report
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = adminController;
