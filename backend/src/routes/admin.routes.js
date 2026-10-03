const express = require('express');
const router = express.Router();

const adminController = require('../controllers/admin.controller');
const requireAuth = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');

// Todas las rutas de administración requieren autenticación y rol de Administrador
router.use(requireAuth);
router.use(requireRole('Administrador'));

router.get('/users', adminController.getAllUsers);
router.patch('/users/:id/status', adminController.updateUserStatus);
router.patch('/users/:id/role', adminController.updateUserRole);
router.get('/audit-logs', adminController.getAuditLogs);

module.exports = router;
