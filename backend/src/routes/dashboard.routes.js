const router = require('express').Router();
const requireAuth = require('../middlewares/auth.middleware');
const { getSummary } = require('../controllers/dashboardController');
const authorizeRole = require('../middlewares/role.middleware');
router.get('/', requireAuth, authorizeRole(['Cliente']), getSummary);
module.exports = router;
