const express = require("express");
const router = express.Router();

const adminController = require("../controllers/admin.controller");
const requireAuth = require("../middlewares/auth.middleware");
const authorizeRole = require("../middlewares/role.middleware");

// Todas las rutas requieren autenticación y rol Administrador
router.use(requireAuth, authorizeRole(["Administrador"]));

// Endpoints Fase 7 - Panel de Administración
router.get("/stats", adminController.getStats);
router.get("/users", adminController.getUsers);
router.get("/storage-metrics", adminController.getStorageMetrics);
router.get("/subscriptions", adminController.getSubscriptions);
router.get("/revenue", adminController.getRevenue);

// Endpoints preexistentes preservados
router.get("/overview", adminController.getOverview);
router.patch("/users/:id/status", adminController.updateUserStatus);
router.patch("/users/:id/role", adminController.updateUserRole);
router.get("/audit-logs", adminController.getAuditLogs);

module.exports = router;
