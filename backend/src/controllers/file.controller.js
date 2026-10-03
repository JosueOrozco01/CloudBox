const FileService = require('../services/file.service');

const fileController = {
    async getUserFiles(req, res) {
        try {
            const userId = parseInt(req.user.id, 10);

            const folderId =
                req.query.folderId !== undefined &&
                    req.query.folderId !== 'null'
                    ? parseInt(req.query.folderId, 10)
                    : null;

            if (folderId !== null && isNaN(folderId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de carpeta inválido'
                });
            }

            const files = await FileService.getUserFiles(
                userId,
                folderId
            );

            return res.status(200).json({
                success: true,
                data: files
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    async getFileById(req, res) {
        try {
            const userId = parseInt(req.user.id, 10);
            const fileId = parseInt(req.params.id, 10);

            if (isNaN(fileId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de archivo inválido'
                });
            }

            const file = await FileService.getFileById(
                fileId,
                userId
            );

            if (!file) {
                return res.status(404).json({
                    success: false,
                    message: 'Archivo no encontrado'
                });
            }

            return res.status(200).json({
                success: true,
                data: file
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
};

module.exports = fileController;