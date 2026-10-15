const express = require('express');
const shareController = require('../controllers/share.controller');
const requireAuth = require('../middlewares/auth.middleware');

const router = express.Router();

// Guard all share endpoints to ensure req.user is verified and populated
router.use(requireAuth);

router.post('/files', shareController.shareFile);

// Register literal paths before wildcard parameters to prevent route resolution shadowing
router.get('/sent', shareController.getSharedByUser);
router.get('/received/files', shareController.getSharedFilesWithUser);

router.get('/:id', shareController.getShareById);
router.patch('/:id/permission', shareController.changePermission);
router.patch('/:id/revoke', shareController.revokeShare);

module.exports = router;
