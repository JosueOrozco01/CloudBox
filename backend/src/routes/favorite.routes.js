const express = require('express');

const favoriteController =
    require('../controllers/favorite.controller');

const requireAuth =
    require('../middlewares/auth.middleware');

const router = express.Router();

router.use(requireAuth);

router.get(
    '/',
    favoriteController.getFavorites
);

router.post(
    '/:fileId',
    favoriteController.addFavorite
);

router.delete(
    '/:fileId',
    favoriteController.removeFavorite
);

module.exports = router;
