const FileService = require('../services/file.service');
const StorageService = require('../services/storage.service');
const FileValidationService = require('../services/file-validation.service');
const QuotaService = require('../services/quota.service');

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
    },

    async uploadFile(req, res) {
        let uploadedPath = null;

        try {
            const userId = parseInt(req.user.id, 10);

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Debe seleccionar un archivo'
                });
            }

            const validation =
                await FileValidationService.validateFile({
                    originalName: req.file.originalname,
                    size: req.file.size
                });

            await QuotaService.validateUpload(
                userId,
                validation.size
            );

            const storageResult =
                await StorageService.uploadFile({
                    userId,
                    fileName: validation.name,
                    buffer: req.file.buffer,
                    mimeType: req.file.mimetype
                });

            uploadedPath = storageResult.path;

            const file =
                await FileService.createFileRecord({
                    name: validation.name,
                    size: validation.size,
                    storagePath: storageResult.path,
                    userId,
                    folderId: null,
                    extensionId: validation.extension.id
                });

            try {
                await QuotaService.syncUsedStorage(userId);
            } catch (quotaError) {
                console.error(
                    'Error al actualizar el espacio utilizado:',
                    quotaError.message
                );
            }

            return res.status(201).json({
                success: true,
                message: 'Archivo subido correctamente',
                data: file
            });
        } catch (error) {
            if (uploadedPath) {
                try {
                    await StorageService.deleteFile(
                        uploadedPath
                    );
                } catch (cleanupError) {
                    console.error(
                        'Error al limpiar archivo de Storage:',
                        cleanupError.message
                    );
                }
            }

            return res.status(error.status || 500).json({
                success: false,
                code: error.code,
                message: error.message
            });
        }
    }
};

module.exports = fileController;