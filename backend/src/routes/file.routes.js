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
    fileController.uploadFile
);

router.get(
    '/:id/download-url',
    fileController.getDownloadUrl
);

router.get(
    '/:id/download',
    fileController.downloadFile
);

router.patch(
    '/:id/move',
    fileController.moveFile
);

router.patch(
    '/:id/trash',
    fileController.moveToTrash
);

router.patch(
    '/:id/restore',
    fileController.restoreFile
);

router.delete(
    '/:id/permanent',
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