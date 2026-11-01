
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

router.post('/me/avatar', (req,res,next) => require('multer')({ storage: require('multer').memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0 } }).single('avatar')(req,res,error => error ? res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({success:false,message:'Usa una imagen PNG, JPG o WebP de hasta 2 MB.'}) : next()), require('../controllers/integrations.controller').avatar);

// Obtener perfil del usuario autenticado
router.get('/me', userController.getMyProfile);

// Actualizar perfil del usuario autenticado
router.patch('/me', userController.updateMyProfile);

// Obtener información de almacenamiento
router.get('/me/storage', userController.getMyStorage);

// Desactivar la cuenta del usuario autenticado
router.patch('/me/deactivate', userController.deactivateMyAccount);

module.exports = router;
