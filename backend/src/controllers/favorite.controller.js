const FavoriteService = require('../services/favorite.service');

function parseFileId(value) {
    const fileId = parseInt(value, 10);

    if (Number.isNaN(fileId) || fileId <= 0) {
        return null;
    }

    return fileId;
}

const favoriteController = {
    async getFavorites(req, res) {
        try {
            const userId = parseInt(req.user.id, 10);

            const favorites =
                await FavoriteService.getFavorites(userId);

            return res.status(200).json({
                success: true,
                data: favorites
            });
        } catch (error) {
            return res.status(error.status || 500).json({
                success: false,
                code: error.code,
                message: error.message
            });
        }
    },

    async addFavorite(req, res) {
        try {
            const userId = parseInt(req.user.id, 10);
            const fileId = parseFileId(req.params.fileId);

            if (!fileId) {
                return res.status(400).json({
                    success: false,
                    code: 'INVALID_FILE_ID',
                    message: 'ID de archivo inválido'
                });
            }

            const favorite =
                await FavoriteService.addFavorite(
                    userId,
                    fileId
                );

            return res.status(201).json({
                success: true,
                message: 'Archivo agregado a favoritos',
                data: favorite
            });
        } catch (error) {
            return res.status(error.status || 500).json({
                success: false,
                code: error.code,
                message: error.message
            });
        }
    },

    async removeFavorite(req, res) {
        try {
            const userId = parseInt(req.user.id, 10);
            const fileId = parseFileId(req.params.fileId);

            if (!fileId) {
                return res.status(400).json({
                    success: false,
                    code: 'INVALID_FILE_ID',
                    message: 'ID de archivo inválido'
                });
            }

            const favorite =
                await FavoriteService.removeFavorite(
                    userId,
                    fileId
                );

            return res.status(200).json({
                success: true,
                message: 'Archivo eliminado de favoritos',
                data: favorite
            });
        } catch (error) {
            return res.status(error.status || 500).json({
                success: false,
                code: error.code,
                message: error.message
            });
        }
    }
};

module.exports = favoriteController;