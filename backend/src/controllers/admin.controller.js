
const AdminService = require("../services/admin.service");
const auditService = require("../services/audit.service");

const adminController = {
  async getOverview(req, res, next) {
    try {
      const data = await AdminService.getOverview();

      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      return next(error);
    }
  },

  /**
   * Módulo ADM: Listado paginado de usuarios con filtros.
   */
  async getUsers(req, res, next) {
    try {
      const { q, search, status, limit, offset, plan, days, sort, page } = req.query || {};

      const result = await AdminService.getUsersList({
        q: q || search, plan, days, sort, page,
        status,
        limit,
        offset,
      });

      return res.status(200).json({
        success: true,
        data: result.users,
        pagination: result.pagination,
      });
    } catch (error) {
      return next(error);
    }
  },

  /**
   * Alias de compatibilidad con rutas anteriores.
   */
  async getAllUsers(req, res, next) {
    return adminController.getUsers(req, res, next);
  },

  /**
   * Módulo ADM: Obtener usuario por ID.
   */
  async getUserById(req, res, next) {
    try {
      const targetUserId = Number(req.params.id);

      if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
        return res.status(400).json({
          success: false,
          status: 400,
          code: "INVALID_USER_ID",
          message: "ID de usuario inválido",
        });
      }

      const user = await AdminService.getUserById(targetUserId);

      return res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      return next(error);
    }
  },

  /**
   * Módulo ADM: Actualizar estado de usuario.
   */
  async updateUserStatus(req, res, next) {
    try {
      const targetUserId = Number(req.params.id);
      const { id_estado } = req.body || {};
      const currentUserId = Number(req.user?.id);
      const newStatusId = Number(id_estado);

      if (
        !Number.isInteger(targetUserId) ||
        targetUserId <= 0 ||
        id_estado == null ||
        !Number.isInteger(newStatusId) ||
        newStatusId <= 0
      ) {
        return res.status(400).json({
          success: false,
          status: 400,
          code: "INVALID_IDENTIFIER",
          message: "ID de usuario o estado inválido",
        });
      }

      // Evitar que el administrador suspenda su propia cuenta.
      if (targetUserId === currentUserId) {
        return res.status(400).json({
          success: false,
          status: 400,
          code: "CANNOT_MODIFY_OWN_ACCOUNT",
          message: "No puedes suspender tu propia cuenta",
        });
      }

      const ip_origen =
        req.headers["x-forwarded-for"] ||
        req.socket?.remoteAddress ||
        req.ip;

      const updatedUser = await AdminService.updateUserStatus(
        targetUserId,
        newStatusId,
        { currentUserId, ip_origen }
      );

      return res.status(200).json({
        success: true,
        message: "Estado de usuario actualizado exitosamente",
        data: updatedUser,
      });
    } catch (error) {
      return next(error);
    }
  },

  /**
   * Módulo ADM: Actualizar rol de usuario.
   */
  async updateUserRole(req, res, next) {
    try {
      const targetUserId = Number(req.params.id);
      const { id_rol } = req.body || {};
      const currentUserId = Number(req.user?.id);
      const newRoleId = Number(id_rol);

      if (
        !Number.isInteger(targetUserId) ||
        targetUserId <= 0 ||
        id_rol == null ||
        !Number.isInteger(newRoleId) ||
        newRoleId <= 0
      ) {
        return res.status(400).json({
          success: false,
          status: 400,
          code: "INVALID_IDENTIFIER",
          message: "ID de usuario o rol inválido",
        });
      }

      // Evitar que el administrador cambie su propio rol.
      if (targetUserId === currentUserId) {
        return res.status(400).json({
          success: false,
          status: 400,
          code: "CANNOT_MODIFY_OWN_ROLE",
          message: "No puedes degradar tus propios privilegios",
        });
      }

      const ip_origen =
        req.headers["x-forwarded-for"] ||
        req.socket?.remoteAddress ||
        req.ip;

      const updatedUser = await AdminService.updateUserRole(
        targetUserId,
        newRoleId,
        { currentUserId, ip_origen }
      );

      return res.status(200).json({
        success: true,
        message: "Rol de usuario actualizado exitosamente",
        data: updatedUser,
      });
    } catch (error) {
      return next(error);
    }
  },

  /**
   * Módulo AUD: Consultar bitácora de auditoría.
   */
  async getAuditLogs(req, res, next) {
    try {
      const limit = Math.min(
        200,
        Math.max(1, parseInt(req.query?.limit, 10) || 20)
      );

      const offset = Math.max(
        0,
        parseInt(req.query?.offset, 10) || 0
      );

      const data = await AdminService.getAuditLogs(limit, offset);

      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      return next(error);
    }
  },

  /**
   * Módulo STO: Estadísticas generales de almacenamiento.
   */
  async getStorageOverview(req, res, next) {
    try {
      const data = await AdminService.getStorageOverview();

      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      return next(error);
    }
  },

  /**
   * Módulo STO: Almacenamiento por usuario.
   */
  async getStorageUsers(req, res, next) {
    try {
      const { limit, offset, overQuota } = req.query || {};

      const result = await AdminService.getStorageUsers({
        limit,
        offset,
        overQuota,
      });

      return res.status(200).json({
        success: true,
        data: result.users,
        pagination: result.pagination,
      });
    } catch (error) {
      return next(error);
    }
  },

  /**
   * Módulo STO: Usuarios que exceden su cuota.
   */
  async getUsersOverQuota(req, res, next) {
    try {
      const { limit, offset } = req.query || {};

      const result = await AdminService.getUsersOverQuota({
        limit,
        offset,
      });

      return res.status(200).json({
        success: true,
        data: result.users,
        pagination: result.pagination,
      });
    } catch (error) {
      return next(error);
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
        message: "Estadísticas globales obtenidas exitosamente",
        data: stats,
      });
    } catch (error) {
      return next(error);
    }
  },

  async getStorageMetrics(req, res, next) {
    try {
      const metrics = await AdminService.getStorageMetrics();

      return res.status(200).json({
        success: true,
        message: "Métricas de almacenamiento obtenidas exitosamente",
        data: metrics,
      });
    } catch (error) {
      return next(error);
    }
  },

  async getSubscriptions(req, res, next) {
    try {
      const result = await AdminService.getAllSubscriptions(req.query);

      return res.status(200).json({
        success: true,
        message: "Suscripciones obtenidas exitosamente",
        data: result.subscriptions,
        pagination: result.pagination,
      });
    } catch (error) {
      return next(error);
    }
  },

  async getRevenue(req, res, next) {
    try {
      const { startDate, endDate } = req.query || {};

      const report = await AdminService.getRevenueReport({
        startDate,
        endDate,
      });

      return res.status(200).json({
        success: true,
        message: "Reporte financiero obtenido exitosamente",
        data: report,
      });
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = adminController;
