const express = require('express');

const activityController =
    require('../controllers/activity.controller');

const requireAuth =
    require('../middlewares/auth.middleware');

const router = express.Router();

router.use(requireAuth);

router.get(
    '/',
    activityController.getUserActivity
);

module.exports = router;