const AdminService = require("../services/admin.service");
const auditService = require("../services/audit.service");

const adminController = {
  async getOverview(req, res) {
    try {
      const data = await AdminService.getOverview();
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      return res.status(error.status || 500).json({
        success: false,
        status: error.status || 500,
        code: error.code || "SERVER_ERROR",
        message: error.message,
      });
    }
  },

  /**
   * Módulo ADM: Listado paginado de usuarios con soporte de filtros (q, status).
   */
  async getUsers(req, res) {
    try {
      const { q, search, status, limit, offset } = req.query || {};
      const result = await AdminService.getUsersList({
        q: q || search,
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
      return res.status(error.status || 500).json({
        success: false,
        status: error.status || 500,
        code: error.code || "SERVER_ERROR",
        message: error.message,
      });
    }
  },

  /**
   * Alias de compatibilidad para rutas previas.
   */
  async getAllUsers(req, res) {
    return adminController.getUsers(req, res);
  },

  /**
   * Módulo ADM: Detalle individual de un usuario por ID.
   */
  async getUserById(req, res) {
    try {
      const targetUserId = Number(req.params.id);
      if (isNaN(targetUserId)) {
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
      return res.status(error.status || 500).json({
        success: false,
        status: error.status || 500,
        code: error.code || "SERVER_ERROR",
        message: error.message,
      });
    }
  },

  /**
   * Módulo ADM: Actualizar estado de usuario con regla anti-autodesactivación y AUD-01.
   */
  async updateUserStatus(req, res) {
    try {
      const targetUserId = Number(req.params.id);
      const { id_estado } = req.body || {};
      const currentUserId = parseInt(req.user?.id, 10);

      if (isNaN(targetUserId) || !id_estado) {
        return res.status(400).json({
          success: false,
          status: 400,
          code: "INVALID_IDENTIFIER",
          message: "ID de usuario o estado inválido",
        });
      }

      // Evitar que el administrador suspenda su propia cuenta
      if (targetUserId === currentUserId) {
        return res.status(400).json({
          success: false,
          status: 400,
          code: "CANNOT_MODIFY_OWN_ACCOUNT",
          message: "No puedes suspender tu propia cuenta",
        });
      }

      const newStatusId = Number(id_estado);
      const ip_origen =
        req.headers["x-forwarded-for"] || req.socket?.remoteAddress || req.ip;

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
      return res.status(error.status || 500).json({
        success: false,
        status: error.status || 500,
        code: error.code || "SERVER_ERROR",
        message: error.message,
      });
    }
  },

  /**
   * Módulo ADM: Actualizar rol de usuario con regla anti-degradación y AUD-01.
   */
  async updateUserRole(req, res) {
    try {
      const targetUserId = Number(req.params.id);
      const { id_rol } = req.body || {};
      const currentUserId = parseInt(req.user?.id, 10);

      if (isNaN(targetUserId) || !id_rol) {
        return res.status(400).json({
          success: false,
          status: 400,
          code: "INVALID_IDENTIFIER",
          message: "ID de usuario o rol inválido",
        });
      }

      // Evitar que el administrador cambie su propio rol
      if (targetUserId === currentUserId) {
        return res.status(400).json({
          success: false,
          status: 400,
          code: "CANNOT_MODIFY_OWN_ROLE",
          message: "No puedes degradar tus propios privilegios",
        });
      }

      const newRoleId = Number(id_rol);
      const ip_origen =
        req.headers["x-forwarded-for"] || req.socket?.remoteAddress || req.ip;

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
      return res.status(error.status || 500).json({
        success: false,
        status: error.status || 500,
        code: error.code || "SERVER_ERROR",
        message: error.message,
      });
    }
  },

  async getAuditLogs(req, res) {
    try {
      const limit = Math.min(
        200,
        Math.max(1, parseInt(req.query?.limit, 10) || 20),
      );
      const offset = Math.max(0, parseInt(req.query?.offset, 10) || 0);

      const data = await AdminService.getAuditLogs(limit, offset);

      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      return res.status(error.status || 500).json({
        success: false,
        status: error.status || 500,
        code: error.code || "SERVER_ERROR",
        message: "Error al obtener bitácora",
        error: error.message,
      });
    }
  },

  /**
   * Módulo STO: Estadísticas generales de almacenamiento y archivos.
   */
  async getStorageOverview(req, res) {
    try {
      const data = await AdminService.getStorageOverview();
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      return res.status(error.status || 500).json({
        success: false,
        status: error.status || 500,
        code: error.code || "SERVER_ERROR",
        message: error.message,
      });
    }
  },

  /**
   * Módulo STO: Almacenamiento por usuario con paginación y filtro overQuota.
   */
  async getStorageUsers(req, res) {
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
      return res.status(error.status || 500).json({
        success: false,
        status: error.status || 500,
        code: error.code || "SERVER_ERROR",
        message: error.message,
      });
    }
  },

  /**
   * Módulo STO: Usuarios sobre cuota (espacio_usado_bytes > maxBytes).
   */
  async getUsersOverQuota(req, res) {
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
      return res.status(error.status || 500).json({
        success: false,
        status: error.status || 500,
        code: error.code || "SERVER_ERROR",
        message: error.message,
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
      if (typeof next === 'function') return next(error);
      return res.status(error.status || 500).json({
        success: false,
        status: error.status || 500,
        code: error.code || 'SERVER_ERROR',
        message: error.message
      });
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
      if (typeof next === 'function') return next(error);
      return res.status(error.status || 500).json({
        success: false,
        status: error.status || 500,
        code: error.code || 'SERVER_ERROR',
        message: error.message
      });
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
      if (typeof next === 'function') return next(error);
      return res.status(error.status || 500).json({
        success: false,
        status: error.status || 500,
        code: error.code || 'SERVER_ERROR',
        message: error.message
      });
    }
  },

  async getRevenue(req, res, next) {
    try {
      const { startDate, endDate } = req.query || {};
      const report = await AdminService.getRevenueReport({ startDate, endDate });
      return res.status(200).json({
        success: true,
        message: 'Reporte financiero obtenido exitosamente',
        data: report
      });
    } catch (error) {
      if (typeof next === 'function') return next(error);
      return res.status(error.status || 500).json({
        success: false,
        status: error.status || 500,
        code: error.code || 'SERVER_ERROR',
        message: error.message
      });
    }
  }
};

module.exports = adminController;


