const express = require('express');
const supabase = require('../config/supabase');
const requireAuth = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'CloudBox Backend funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

router.get('/supabase', async (req, res) => {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Supabase connection failed',
        error: error.message
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Supabase connection is working'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Supabase connection failed',
      error: error.message
    });
  }
});

module.exports = router;


// temporal solo para verificar que este cumpliendo la conexion de la base de datos, funciona pero el rls 
//evita su lectura, este comentario y codigo no van a producion solo es de verificación 
router.get('/database', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('rol')
      .select('*');

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Database connection failed',
        error: error.message
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Database connection is working',
      data
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error.message
    });
  }
});


// Verify authentication before exposing protected user data 
//comentario de prueba 
router.get('/protected', requireAuth, (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Protected route accessed successfully',
    user: {
      id: req.authUser.id,
      email: req.authUser.email
    }
  });
});