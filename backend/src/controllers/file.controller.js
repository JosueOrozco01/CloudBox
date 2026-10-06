const FileService = require('../services/file.service');
const FolderService = require('../services/folder.service');
const StorageService = require('../services/storage.service');
const FileValidationService = require('../services/file-validation.service');
const QuotaService = require('../services/quota.service');

const ACTIVE_FILE_STATUS = 1;
const TRASH_FILE_STATUS = 2;

function getFileExtension(fileName) {
    const lastDotIndex = fileName.lastIndexOf('.');

    if (lastDotIndex <= 0) {
        return '';
    }

    return fileName
        .slice(lastDotIndex)
        .toLowerCase();
}

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

            if (file.id_estado !== ACTIVE_FILE_STATUS) {
                return res.status(409).json({
                    success: false,
                    code: 'FILE_NOT_AVAILABLE',
                    message:
                        'El archivo no está disponible para descarga'
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
                folderId = parseInt(
                    req.body.folderId,
                    10
                );

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

            const file =
                await FileService.moveToTrash(
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

    async restoreFile(req, res) {
        try {
            const userId = parseInt(req.user.id, 10);
            const fileId = parseInt(req.params.id, 10);

            if (isNaN(fileId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de archivo inválido'
                });
            }

            const file = await FileService.restoreFile(
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
                message:
                    'Archivo restaurado correctamente',
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

    async deleteFilePermanently(req, res) {
        try {
            const userId = parseInt(req.user.id, 10);
            const fileId = Number(req.params.id);

            if (!Number.isSafeInteger(fileId) || fileId <= 0) {
                return res.status(400).json({
                    success: false,
                    code: 'INVALID_FILE_ID',
                    message: 'ID de archivo inválido'
                });
            }

            const file = await FileService.getFileById(fileId, userId);

            if (!file) {
                return res.status(404).json({
                    success: false,
                    message: 'Archivo no encontrado'
                });
            }

            // Status 3 permits retrying a physical deletion after a failure.
            if (file.id_estado !== TRASH_FILE_STATUS && file.id_estado !== 3) {
                return res.status(400).json({
                    success: false,
                    code: 'FILE_NOT_IN_TRASH',
                    message: 'El archivo debe estar en la papelera antes de eliminarse permanentemente'
                });
            }

            // Mark the database record first to preserve a retryable storage path.
            // A missing Storage object is safe to delete again when retried.
            const deletedFile = file.id_estado === TRASH_FILE_STATUS
                ? await FileService.markAsDeleted(fileId, userId)
                : file;

            try {
                await StorageService.deleteFile(deletedFile.ruta_storage);
            } catch (storageError) {
                console.error('Physical file deletion pending:', {
                    fileId,
                    userId,
                    error: storageError.message
                });

                return res.status(503).json({
                    success: false,
                    code: 'STORAGE_DELETE_PENDING',
                    message: 'El archivo se marcó como eliminado, pero Storage no confirmó el borrado. Reintenta esta misma operación.',
                    data: { fileId, id_estado: 3 }
                });
            }

            let quotaSyncPending = false;
            try {
                await QuotaService.syncUsedStorage(userId);
            } catch (quotaError) {
                quotaSyncPending = true;
                console.error('Quota synchronization pending after deletion:', {
                    userId,
                    fileId,
                    error: quotaError.message
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Archivo eliminado permanentemente',
                data: deletedFile,
                ...(quotaSyncPending ? { quotaSyncPending: true } : {})
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
                    message:
                        'Debe seleccionar un archivo'
                });
            }

            let folderId = null;

            if (
                req.body.folderId !== undefined &&
                req.body.folderId !== '' &&
                req.body.folderId !== 'null'
            ) {
                folderId = parseInt(
                    req.body.folderId,
                    10
                );

                if (isNaN(folderId)) {
                    return res.status(400).json({
                        success: false,
                        message:
                            'ID de carpeta inválido'
                    });
                }

                const isValidFolder =
                    await FolderService.validateFolderOwnership(
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
                    originalName:
                        req.file.originalname,
                    size: req.file.size
                });

            const duplicateExists =
                await FileService.fileNameExists(
                    userId,
                    folderId,
                    validation.name
                );

            if (duplicateExists) {
                return res.status(409).json({
                    success: false,
                    code: 'DUPLICATE_FILE_NAME',
                    message:
                        'Ya existe un archivo con ese nombre en la carpeta'
                });
            }

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
                    storagePath:
                        storageResult.path,
                    userId,
                    folderId,
                    extensionId:
                        validation.extension.id
                });

            try {
                await QuotaService.syncUsedStorage(
                    userId
                );
            } catch (quotaError) {
                console.error(
                    'Error al actualizar el espacio utilizado:',
                    quotaError.message
                );
            }

            return res.status(201).json({
                success: true,
                message:
                    'Archivo subido correctamente',
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
    },

    async getTrashFiles(req, res) {
        try {
            const userId = parseInt(req.user.id, 10);

            const files =
                await FileService.getTrashFiles(
                    userId
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

    async renameFile(req, res) {
        try {
            const userId = parseInt(req.user.id, 10);
            const fileId = parseInt(req.params.id, 10);

            if (isNaN(fileId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de archivo inválido'
                });
            }

            const newName =
                typeof req.body.name === 'string'
                    ? req.body.name.trim()
                    : '';

            if (!newName) {
                return res.status(400).json({
                    success: false,
                    code: 'INVALID_FILE_NAME',
                    message:
                        'El nombre del archivo es obligatorio'
                });
            }

            if (
                newName.length > 255 ||
                newName.includes('/') ||
                newName.includes('\\') ||
                newName.includes('\0')
            ) {
                return res.status(400).json({
                    success: false,
                    code: 'INVALID_FILE_NAME',
                    message:
                        'El nombre del archivo no es válido'
                });
            }

            const currentFile =
                await FileService.getFileById(
                    fileId,
                    userId
                );

            if (!currentFile) {
                return res.status(404).json({
                    success: false,
                    message: 'Archivo no encontrado'
                });
            }

            const currentExtension =
                getFileExtension(
                    currentFile.nombre
                );

            const newExtension =
                getFileExtension(newName);

            if (
                currentExtension !==
                newExtension
            ) {
                return res.status(400).json({
                    success: false,
                    code: 'FILE_EXTENSION_CHANGE_NOT_ALLOWED',
                    message:
                        'No se permite cambiar la extensión del archivo'
                });
            }

            const file =
                await FileService.renameFile(
                    fileId,
                    userId,
                    newName
                );

            return res.status(200).json({
                success: true,
                message:
                    'Archivo renombrado correctamente',
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
    async downloadFile(req, res) {
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

            if (file.id_estado !== ACTIVE_FILE_STATUS) {
                return res.status(409).json({
                    success: false,
                    code: 'FILE_NOT_AVAILABLE',
                    message:
                        'El archivo no está disponible para descarga'
                });
            }

            const signedUrl =
                await StorageService.createSignedUrl(
                    file.ruta_storage,
                    60
                );

            return res.redirect(signedUrl);
        } catch (error) {
            return res.status(error.status || 500).json({
                success: false,
                code: error.code,
                message: error.message
            });
        }
    }

};

module.exports = fileController;