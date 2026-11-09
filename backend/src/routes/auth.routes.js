const express = require('express');
const authController = require('../controllers/authController');
const validateRegistration = require('../middlewares/registration-validation.middleware');

const router = express.Router();
router.use(require('../middlewares/auth-rate-limit.middleware'));

router.post('/refresh', require('../controllers/auth-extra.controller').refresh);
router.post('/resend-verification', require('../controllers/auth-extra.controller').resend);

router.post('/register', validateRegistration, authController.register);

// Verify email routes (Supports both POST with manual code and GET for magic links)
router.post('/verify-email', authController.verifyEmail);
router.get('/verify', authController.verifyEmail);

// Login route
router.post('/login', authController.login);

router.post('/logout', authController.logout);

// Password recovery routes
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

module.exports = router;
