const express = require('express');

const supabase = require('../config/supabase');

const requireAuth = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');
const validateRegistration =
  require('../middlewares/registration-validation.middleware');
const validatePasswordRecovery =
  require('../middlewares/password-recovery-validation.middleware');
const validatePasswordUpdate =
  require('../middlewares/password-update-validation.middleware');

const {
  requestPasswordRecovery,
  resendEmailConfirmation,
  signOutUser
} = require('../services/auth.service');

const router = express.Router();

// -----------------------------------------------------------------------------
// Health checks
// -----------------------------------------------------------------------------

router.get('/', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'CloudBox Backend funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

router.get('/supabase', async (req, res, next) => {
  try {
    const { error } = await supabase.auth.getSession();

    if (error) {
      const connectionError =
        new Error('Supabase connection failed');

      connectionError.code = 'SUPABASE_CONNECTION_FAILED';
      connectionError.status = 500;
      connectionError.cause = error;

      throw connectionError;
    }

    return res.status(200).json({
      success: true,
      message: 'Supabase connection is working'
    });
  } catch (error) {
    next(error);
  }
});

// Temporary route used only to verify database connectivity.
// RLS may prevent anonymous reads even when the connection is working.
router.get('/database', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('rol')
      .select('*');

    if (error) {
      const databaseError =
        new Error('Database connection failed');

      databaseError.code = 'DATABASE_CONNECTION_FAILED';
      databaseError.status = 500;
      databaseError.cause = error;

      throw databaseError;
    }

    return res.status(200).json({
      success: true,
      message: 'Database connection is working',
      data
    });
  } catch (error) {
    next(error);
  }
});


// Authentication and authorization tests


router.get(
  '/protected',
  requireAuth,
  (req, res) => {
    return res.status(200).json({
      success: true,
      message: 'Protected route accessed successfully',
      user: req.user
    });
  }
);

router.get(
  '/admin-only',
  requireAuth,
  requireRole('administrador'),
  (req, res) => {
    return res.status(200).json({
      success: true,
      message: 'Administrator access granted'
    });
  }
);

router.get(
  '/client-only',
  requireAuth,
  requireRole('cliente'),
  (req, res) => {
    return res.status(200).json({
      success: true,
      message: 'Client access granted',
      user: req.user
    });
  }
);


// Registration validation tests


router.post(
  '/registration-validation',
  validateRegistration,
  (req, res) => {
    const {
      firstName,
      lastName,
      email
    } = req.body;

    return res.status(200).json({
      success: true,
      message: 'Registration data is valid',
      data: {
        firstName,
        lastName,
        email
      }
    });
  }
);


// Password recovery tests


router.post(
  '/password-recovery-validation',
  validatePasswordRecovery,
  (req, res) => {
    return res.status(200).json({
      success: true,
      message: 'Password recovery data is valid',
      data: {
        email: req.body.email
      }
    });
  }
);

router.post(
  '/password-recovery-test',
  validatePasswordRecovery,
  async (req, res, next) => {
    try {
      await requestPasswordRecovery(req.body.email);

      return res.status(200).json({
        success: true,
        message: 'Password recovery request processed successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/password-update-validation',
  validatePasswordUpdate,
  (req, res) => {
    return res.status(200).json({
      success: true,
      message: 'Password data is valid'
    });
  }
);


// Email confirmation tests


router.post(
  '/email-confirmation-test',
  validatePasswordRecovery,
  async (req, res, next) => {
    try {
      await resendEmailConfirmation(req.body.email);

      return res.status(200).json({
        success: true,
        message: 'Email confirmation request processed successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);


// Logout tests

router.post(
  '/logout-test',
  async (req, res, next) => {
    try {
      const authorizationHeader =
        req.headers.authorization;

      if (!authorizationHeader) {
        return res.status(401).json({
          success: false,
          code: 'AUTH_TOKEN_REQUIRED',
          message: 'Authorization token is required'
        });
      }

      const [scheme, accessToken] =
        authorizationHeader.split(' ');

      if (scheme !== 'Bearer' || !accessToken) {
        return res.status(401).json({
          success: false,
          code: 'INVALID_AUTH_FORMAT',
          message: 'Invalid authorization format'
        });
      }

      const { refreshToken } = req.body;

      await signOutUser(
        accessToken,
        refreshToken
      );

      return res.status(200).json({
        success: true,
        message: 'User signed out successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;