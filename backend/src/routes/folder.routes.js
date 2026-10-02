const express = require('express');
const router = express.Router();
const folderController = require('../controllers/folder.controller');
const requireAuth = require('../middlewares/auth.middleware');

router.use(requireAuth);

router.get('/', folderController.getUserFolders);
router.post('/', folderController.createFolder);
router.get('/:id', folderController.getFolderById);
router.put('/:id', folderController.updateFolderName);
router.get('/:id/subfolders', folderController.getSubfolders);
router.get('/:id/content', folderController.getFolderContent);
router.patch('/:id/move', folderController.moveFolder);
router.delete('/:id', folderController.deleteFolder);

module.exports = router;
