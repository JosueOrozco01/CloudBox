const express = require('express');
const router = express.Router();
const PlanController = require('../controllers/plan.controller');
const requireAuth = require('../middlewares/auth.middleware');
const authorizeRole = require('../middlewares/role.middleware');

router.get('/', PlanController.getActivePlans);
router.get('/:id', requireAuth, PlanController.getPlanById);

// Exclusivo Administradores (valida req.user.role === 'Administrador')
router.post('/', requireAuth, authorizeRole(['Administrador']), PlanController.createPlan);
router.put('/:id', requireAuth, authorizeRole(['Administrador']), PlanController.updatePlan);
router.patch('/:id/status', requireAuth, authorizeRole(['Administrador']), PlanController.setPlanStatus);

module.exports = router;
