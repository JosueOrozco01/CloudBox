const express = require('express');
const userController = require('../controllers/userController');
const authenticateToken = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/profile', authenticateToken, userController.getProfile);
router.put('/profile', authenticateToken, userController.updateProfile);

module.exports = router;
