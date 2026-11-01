const UserService = require('../services/user.service');
const QuotaService = require('../services/quota.service');
const AdminService = require('../services/admin.service');

const userController = {
  async getMyProfile(req, res, next) {
    try {
      const userId = req.user.id;

      const user = await UserService.getProfileById(userId, req.supabase);
      user.avatarUrl = await require('./integrations.controller').avatarUrl(req.authUser);

      return res.status(200).json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  },

  async updateMyProfile(req, res, next) {
    try {
      const userId = req.user.id;
      const { nombre, apellido } = req.body || {};

      if (typeof nombre !== 'string' || !nombre.trim()) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_NAME',
          message: 'El nombre es obligatorio'
        });
      }

      if (typeof apellido !== 'string') {
        return res.status(400).json({
          success: false,
          code: 'INVALID_LAST_NAME',
          message: 'El apellido no es válido'
        });
      }

      const user = await UserService.updateProfile(
        userId,
        {
          nombre: nombre.trim(),
          apellido: apellido.trim()
        },
        req.supabase
      );

      user.avatarUrl = await require('./integrations.controller').avatarUrl(req.authUser);

      return res.status(200).json({
        success: true,
        message: 'Perfil actualizado correctamente',
        data: user
      });
    } catch (error) {
      next(error);
    }
  },

  async getMyStorage(req, res, next) {
    try {
      const userId = req.user.id;

      const metrics = await QuotaService.getStorageMetrics(userId);

      return res.status(200).json({
        success: true,
        data: metrics
      });
    } catch (error) {
      next(error);
    }
  },

  async deactivateMyAccount(req, res, next) {
    try {
      const { password } = req.body || {};

      if (typeof password !== 'string' || !password.trim()) {
        return res.status(400).json({
          success: false,
          code: 'PASSWORD_REQUIRED',
          message: 'Debes ingresar tu contraseña actual'
        });
      }

      // 1. Verificar la contraseña actual
      const validPassword = await UserService.verifyCurrentPassword(
        req.authUser,
        password
      );

      if (!validPassword) {
        return res.status(401).json({
          success: false,
          code: 'INVALID_PASSWORD',
          message: 'La contraseña ingresada es incorrecta'
        });
      }

      // 2. Desactivar la cuenta en PostgreSQL
      // Estado 2 = Inactivo
      await AdminService.updateUserStatus(req.user.id, 2);

      // 3. Revocar sesiones de Supabase Auth
      try {
        await UserService.revokeUserSessions(req.headers.authorization.slice(7));
      } catch (revokeError) {
        console.error(
          'La cuenta fue desactivada, pero no se pudieron revocar las sesiones:',
          revokeError
        );

        // La cuenta ya está inactiva.
        // No devolver un error que sugiera que la desactivación falló.
        return res.status(200).json({
          success: true,
          code: 'ACCOUNT_DEACTIVATED_REVOCATION_PENDING',
          message: 'Tu cuenta ha sido desactivada correctamente',
          warning: 'No se pudieron revocar todas las sesiones'
        });
      }

      // 4. Confirmar desactivación
      return res.status(200).json({
        success: true,
        message: 'Tu cuenta ha sido desactivada correctamente'
      });

    } catch (error) {
      next(error);
    }
  }
};

module.exports = userController;

