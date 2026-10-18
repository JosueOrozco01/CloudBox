
const FavoriteService = require('../services/favorite.service');

// Validar el ID del archivo
function parseFileId(value) {
    const fileId = Number(value);

    if (!Number.isSafeInteger(fileId) || fileId <= 0) {
        return null;
    }

    return fileId;
}

const favoriteController = {

    // Obtener los archivos favoritos del usuario
    async getFavorites(req, res) {
        try {
            const userId = parseInt(req.user.id, 10);

            const favorites = await FavoriteService.getFavorites(userId);

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

    // Agregar un archivo a favoritos
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

            const favorite = await FavoriteService.addFavorite(
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

    // Eliminar un archivo de favoritos
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

            const favorite = await FavoriteService.removeFavorite(
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
