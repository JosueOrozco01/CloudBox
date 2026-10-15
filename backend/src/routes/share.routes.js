const express = require('express');
const shareController = require('../controllers/share.controller');
const requireAuth = require('../middlewares/auth.middleware');

const router = express.Router();

// Guard all share endpoints to ensure req.user is verified and populated
router.use(requireAuth);

router.post('/files', shareController.shareFile);

module.exports = router;
