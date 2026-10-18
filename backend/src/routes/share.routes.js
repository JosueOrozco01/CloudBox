const express = require('express');
const shareController = require('../controllers/share.controller');
const requireAuth = require('../middlewares/auth.middleware');

const router = express.Router();

// Guard all share endpoints to ensure req.user is verified and populated
router.use(requireAuth);

// POST - create shares
router.post('/files', shareController.shareFile);
router.post('/folders', shareController.shareFolder);

// GET - literal paths must be registered before wildcard '/:id' to prevent shadowing
router.get('/sent', shareController.getSharedByUser);
router.get('/received/files', shareController.getSharedFilesWithUser);
router.get('/received/folders', shareController.getSharedFoldersWithUser);

// GET - wildcard parameter route (must come last among GETs)
router.get('/:id', shareController.getShareById);

// PATCH - mutation routes on a specific share
router.patch('/:id/permission', shareController.changePermission);
router.patch('/:id/revoke', shareController.revokeShare);

module.exports = router;
