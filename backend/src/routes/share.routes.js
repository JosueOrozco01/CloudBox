const activity = require('../middlewares/client-activity.middleware');
const express = require('express');
const shareController = require('../controllers/share.controller');
const requireAuth = require('../middlewares/auth.middleware');

const router = express.Router();

// Guard all share endpoints to ensure req.user is verified and populated
router.use(requireAuth);

router.use(async (req, res, next) => {
  if (req.method !== 'POST' || !req.body.receiverEmail) return next();
  try {
    req.body.receiverUserId = await require('../services/share.service').resolveReceiver(req.body.receiverEmail);
    next();
  } catch (error) { next(error); }
});
router.post('/files', activity({ action: 'COMPARTIR_ARCHIVO', entity: 'archivo', description: 'Archivo compartido correctamente.' }), shareController.shareFile);

// Register literal paths before wildcard parameters to prevent route resolution shadowing
router.get('/sent', shareController.getSharedByUser);
router.get('/received/files', shareController.getSharedFilesWithUser);

const ShareService = require('../services/share.service');
const handle = (operation, status = 200) => async (req, res, next) => {
  try { res.status(status).json({ success: true, data: await operation(req) }); }
  catch (error) { next(error); }
};
router.get('/recipients', handle(req => ShareService.searchRecipients({ userId: req.user.id, query: req.query.q })));
router.post('/folders', activity({ action: 'COMPARTIR_CARPETA', entity: 'carpeta', description: 'Carpeta compartida correctamente.' }), handle(req => ShareService.shareFolder({ ...req.body, senderUserId: req.user.id }), 201));
router.get('/received/folders', handle(req => ShareService.getSharedFoldersWithUser(req.user.id)));
router.get('/folders/:id/content', handle(req => ShareService.getSharedFolderContent({ userId: req.user.id, folderId: req.params.id })));
router.get('/files/:id/download-url', activity({ action: 'DESCARGAR_ARCHIVO', entity: 'archivo', description: 'Acceso de descarga a archivo compartido autorizado mediante URL temporal.' }), handle(req => ShareService.getSharedDownload({ userId: req.user.id, fileId: req.params.id })));

router.get('/:id', shareController.getShareById);
router.patch('/:id/permission', shareController.changePermission);
router.patch('/:id/revoke', shareController.revokeShare);

module.exports = router;
