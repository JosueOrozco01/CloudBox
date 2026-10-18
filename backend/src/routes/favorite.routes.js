
const express = require('express');

const favoriteController =
    require('../controllers/favorite.controller');

const requireAuth =
    require('../middlewares/auth.middleware');

const router = express.Router();

// Proteger todas las rutas de favoritos
router.use(requireAuth);

// Obtener todos los archivos favoritos del usuario
router.get(
    '/',
    favoriteController.getFavorites
);

// Agregar un archivo a favoritos
router.post(
    '/:fileId',
    favoriteController.addFavorite
);

// Eliminar un archivo de favoritos
router.delete(
    '/:fileId',
    favoriteController.removeFavorite
);

module.exports = router;
