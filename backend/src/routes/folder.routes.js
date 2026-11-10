const activity = require('../middlewares/client-activity.middleware');
const express = require('express');
const router = express.Router();
const folderController = require('../controllers/folder.controller');
const requireAuth = require('../middlewares/auth.middleware');

router.use(requireAuth);

router.get('/', folderController.getUserFolders);
router.get('/trash', folderController.getTrashFolders);
router.get('/locations', folderController.getFolderLocations);
router.post('/', activity({ action: 'CREAR_CARPETA', entity: 'carpeta', description: 'Carpeta creada correctamente.' }), folderController.createFolder);
router.get('/:id', folderController.getFolderById);
router.put('/:id', folderController.updateFolderName);
router.get('/:id/subfolders', folderController.getSubfolders);
router.get('/:id/content', folderController.getFolderContent);
router.patch('/:id/move', folderController.moveFolder);
router.delete('/:id', activity({ action: 'ELIMINAR_CARPETA', entity: 'carpeta', description: 'Carpeta y su contenido enviados a papelera.' }), folderController.deleteFolder);
router.patch('/:id/restore', folderController.restoreFolder);

module.exports = router;
