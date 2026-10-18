
const express = require('express');
const requireAuth = require('../middlewares/auth.middleware');
const userController = require('../controllers/user.controller');

const router = express.Router();

// Todas las rutas de usuario requieren autenticación
router.use(requireAuth);

const settings = require('../controllers/settings.controller');
router.get('/me/preferences', settings.getPreferences);
router.patch('/me/preferences', settings.savePreferences);
router.get('/me/security', settings.security);
router.patch('/me/password', settings.changePassword);
router.post('/me/logout-others', settings.logoutOthers);

// Obtener perfil del usuario autenticado
router.get('/me', userController.getMyProfile);

// Actualizar perfil del usuario autenticado
router.patch('/me', userController.updateMyProfile);

// Obtener información de almacenamiento
router.get('/me/storage', userController.getMyStorage);

// Desactivar la cuenta del usuario autenticado
router.patch('/me/deactivate', userController.deactivateMyAccount);

module.exports = router;
