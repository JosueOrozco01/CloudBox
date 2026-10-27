const express = require('express');
const router = express.Router();
const StorageControlController = require('../controllers/storage-control.controller');
const requireAuth = require('../middlewares/auth.middleware');

router.get('/quota-summary', requireAuth, StorageControlController.getQuotaSummary);

module.exports = router;
