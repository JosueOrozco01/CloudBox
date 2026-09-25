const express = require('express');
const authController = require('../controllers/authController');
const validateRegistration = require('../middlewares/registration-validation.middleware');
const authenticateToken = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/register', validateRegistration, authController.register);

// Verify email routes (Supports both POST with manual code and GET for magic links)
router.post('/verify-email', authController.verifyEmail);
router.get('/verify', authController.verifyEmail);

// Login route
router.post('/login', authController.login);

// Password recovery routes
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// Logout route
router.post('/logout', authenticateToken, authController.logout);

module.exports = router;
