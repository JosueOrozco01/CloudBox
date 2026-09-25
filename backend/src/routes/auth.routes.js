const express = require('express');
const authController = require('../controllers/authController');
const validateRegistration = require('../middlewares/registration-validation.middleware');

const router = express.Router();

router.post('/register', validateRegistration, authController.register);

module.exports = router;
