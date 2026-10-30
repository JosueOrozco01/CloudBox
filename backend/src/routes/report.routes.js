const express = require("express");
const router = express.Router();

const reportController = require("../controllers/report.controller");
const requireAuth = require("../middlewares/auth.middleware");
const authorizeRole = require("../middlewares/role.middleware");

// Todos los reportes administrativos requieren autenticación y rol Administrador (SEC-01)
router.use(requireAuth, authorizeRole(["Administrador"]));

router.get("/overview", reportController.getOverview);
router.get("/subscriptions", reportController.getSubscriptionsReport);
router.get("/revenue", reportController.getRevenueReport);
router.get("/users", reportController.getUsersReport);
router.get("/storage", reportController.getStorageReport);
router.get("/export", reportController.exportReport);

module.exports = router;
