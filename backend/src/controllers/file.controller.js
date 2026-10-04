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

    async getDownloadUrl(req, res) {
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

            const signedUrl =
                await StorageService.createSignedUrl(
                    file.ruta_storage,
                    60
                );

            return res.status(200).json({
                success: true,
                data: {
                    fileId: file.id,
                    name: file.nombre,
                    url: signedUrl,
                    expiresIn: 60
                }
            });
        } catch (error) {
            return res.status(error.status || 500).json({
                success: false,
                code: error.code,
                message: error.message
            });
        }
    },

    async moveFile(req, res) {
        try {
            const userId = parseInt(req.user.id, 10);
            const fileId = parseInt(req.params.id, 10);

            if (isNaN(fileId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de archivo inválido'
                });
            }

            let folderId = null;

            if (
                req.body.folderId !== undefined &&
                req.body.folderId !== null &&
                req.body.folderId !== ''
            ) {
                folderId = parseInt(req.body.folderId, 10);

                if (isNaN(folderId)) {
                    return res.status(400).json({
                        success: false,
                        message: 'ID de carpeta inválido'
                    });
                }
            }

            const file = await FileService.moveFile(
                fileId,
                userId,
                folderId
            );

            if (!file) {
                return res.status(404).json({
                    success: false,
                    message: 'Archivo no encontrado'
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Archivo movido correctamente',
                data: file
            });
        } catch (error) {
            return res.status(error.status || 500).json({
                success: false,
                code: error.code,
                message: error.message
            });
        }
    },

    async moveToTrash(req, res) {
        try {
            const userId = parseInt(req.user.id, 10);
            const fileId = parseInt(req.params.id, 10);

            if (isNaN(fileId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de archivo inválido'
                });
            }

            const file = await FileService.moveToTrash(
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
                message: 'Archivo enviado a papelera',
                data: file
            });
        } catch (error) {
            return res.status(error.status || 500).json({
                success: false,
                code: error.code,
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

            let folderId = null;

            if (
                req.body.folderId !== undefined &&
                req.body.folderId !== '' &&
                req.body.folderId !== 'null'
            ) {
                folderId = parseInt(req.body.folderId, 10);

                if (isNaN(folderId)) {
                    return res.status(400).json({
                        success: false,
                        message: 'ID de carpeta inválido'
                    });
                }

                // TEMPORARY VALIDATION
                // Replace this when backend/folder-management is integrated:
                //
                // const isValidFolder =
                //     await FolderService.validateFolderOwnership(
                //         folderId,
                //         userId
                //     );
                //
                // FileService is used temporarily to avoid copying
                // or modifying Benja's FolderService implementation.
                const isValidFolder =
                    await FileService.validateFolderOwnership(
                        folderId,
                        userId
                    );

                if (!isValidFolder) {
                    return res.status(403).json({
                        success: false,
                        code: 'INVALID_FOLDER',
                        message:
                            'La carpeta no existe o no pertenece al usuario'
                    });
                }
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
                    folderId,
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