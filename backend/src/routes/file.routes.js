const express = require('express');
const router = express.Router();

const fileController = require('../controllers/file.controller');
const requireAuth = require('../middlewares/auth.middleware');

router.use(requireAuth);

router.get('/', fileController.getUserFiles);
router.get('/:id', fileController.getFileById);

module.exports = router;