const express = require('express');
const router = express.Router();

const adminController = require('../controllers/admin.controller');
const requireAuth = require('../middlewares/auth.middleware');
const authorizeRole = require('../middlewares/role.middleware');

// Todas las rutas requieren autenticación y rol Administrador
router.use(requireAuth, authorizeRole(['Administrador']));

// Administración de usuarios
router.get('/users', adminController.getAllUsers);
router.patch('/users/:id/status', adminController.updateUserStatus);
router.patch('/users/:id/role', adminController.updateUserRole);

// Bitácora de auditoría
router.get('/audit-logs', adminController.getAuditLogs);

module.exports = router;