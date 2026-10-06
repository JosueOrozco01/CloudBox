const AdminService = require('../services/admin.service');

const adminController = {
  async getAllUsers(req, res) {
    try {
      const users = await AdminService.getAllUsers();
      res.status(200).json({ success: true, data: users });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async updateUserStatus(req, res) {
    try {
      const targetUserId = parseInt(req.params.id, 10);
      const { id_estado } = req.body;
      const currentUserId = parseInt(req.user.id, 10);

      if (isNaN(targetUserId) || !id_estado) {
        return res.status(400).json({ success: false, message: 'ID de usuario o estado inválido' });
      }

      if (targetUserId === currentUserId) {
        return res.status(400).json({ success: false, message: 'No puedes suspender tu propia cuenta' });
      }

      const updatedUser = await AdminService.updateUserStatus(targetUserId, parseInt(id_estado, 10));
      res.status(200).json({ success: true, data: updatedUser });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async updateUserRole(req, res) {
    try {
      const targetUserId = parseInt(req.params.id, 10);
      const { id_rol } = req.body;
      const currentUserId = parseInt(req.user.id, 10);

      if (isNaN(targetUserId) || !id_rol) {
        return res.status(400).json({ success: false, message: 'ID de usuario o rol inválido' });
      }

      if (targetUserId === currentUserId) {
        return res.status(400).json({ success: false, message: 'No puedes degradar tus propios privilegios' });
      }

      const updatedUser = await AdminService.updateUserRole(targetUserId, parseInt(id_rol, 10));
      res.status(200).json({ success: true, data: updatedUser });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

module.exports = adminController;
