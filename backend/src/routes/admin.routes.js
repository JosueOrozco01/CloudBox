const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const requireAuth = require('../middlewares/auth.middleware');
const authorizeRole = require('../middlewares/role.middleware');

// Aplicar seguridad en cadena: Autenticación + Autorización (solo Administrador)
router.use(requireAuth, authorizeRole(['Administrador']));

router.get('/users', adminController.getAllUsers);
router.patch('/users/:id/status', adminController.updateUserStatus);
router.patch('/users/:id/role', adminController.updateUserRole);

module.exports = router;
