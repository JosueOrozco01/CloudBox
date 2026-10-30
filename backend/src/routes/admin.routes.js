const express = require("express");
const router = express.Router();

const adminController = require("../controllers/admin.controller");
const reportRoutes = require("./report.routes");
const requireAuth = require("../middlewares/auth.middleware");
const authorizeRole = require("../middlewares/role.middleware");

// Todas las rutas requieren autenticación y rol Administrador (SEC-01)
router.use(requireAuth, authorizeRole(["Administrador"]));

// Reportes administrativos (Módulo REP)
router.use("/reports", reportRoutes);

// Vista general y estadísticas de alto nivel
router.get("/overview", adminController.getOverview);
router.get("/stats", adminController.getStats);
router.get("/audit-logs", adminController.getAuditLogs);

// Endpoints analíticos y métricas agregadas (Fase 7)
router.get("/storage-metrics", adminController.getStorageMetrics);
router.get("/subscriptions", adminController.getSubscriptions);
router.get("/revenue", adminController.getRevenue);

// Administración de almacenamiento (Módulo STO)
router.get("/storage/overview", adminController.getStorageOverview);
router.get("/storage/users", adminController.getStorageUsers);
router.get("/storage/over-quota", adminController.getUsersOverQuota);

// Administración de usuarios (Módulo ADM)
router.get("/users", adminController.getUsers);
router.get("/users/:id", adminController.getUserById);
router.patch("/users/:id/status", adminController.updateUserStatus);
router.patch("/users/:id/role", adminController.updateUserRole);

module.exports = router;

