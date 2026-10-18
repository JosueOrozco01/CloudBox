const activity = require('../middlewares/client-activity.middleware');
const express = require('express');
const fileController = require('../controllers/file.controller');
const uploadMiddleware = require('../middlewares/upload.middleware');
const requireAuth = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(requireAuth);

router.get(
    '/',
    fileController.getUserFiles
);

router.post(
    '/upload',
    uploadMiddleware.single('file'),
    activity({ action: 'SUBIR_ARCHIVO', entity: 'archivo', description: 'Archivo subido correctamente.' }),
    fileController.uploadFile
);

router.get(
    '/:id/download-url',
    activity({ action: 'DESCARGAR_ARCHIVO', entity: 'archivo', description: 'Acceso de descarga autorizado mediante URL temporal.' }),
    fileController.getDownloadUrl
);

router.get(
    '/:id/download',
    activity({ action: 'DESCARGAR_ARCHIVO', entity: 'archivo', description: 'Acceso de descarga autorizado mediante redirección.' }),
    fileController.downloadFile
);

router.patch(
    '/:id/move',
    fileController.moveFile
);

router.patch(
    '/:id/trash',
    activity({ action: 'ELIMINAR_ARCHIVO', entity: 'archivo', description: 'Archivo enviado a papelera.' }),
    fileController.moveToTrash
);

router.patch(
    '/:id/restore',
    fileController.restoreFile
);

router.delete(
    '/:id/permanent',
    activity({ action: 'ELIMINAR_ARCHIVO', entity: 'archivo', description: 'Archivo eliminado permanentemente de Storage.' }),
    fileController.deleteFilePermanently
);
router.get(
    '/trash',
    fileController.getTrashFiles
);
router.patch(
    '/:id/rename',
    fileController.renameFile
);


router.get(
    '/:id',
    fileController.getFileById
);

module.exports = router;