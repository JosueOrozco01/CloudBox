const ReportService = require("../services/report.service");

const reportController = {
  /**
   * Resumen consolidado de métricas (Overview Report).
   */
  async getOverview(req, res) {
    try {
      const { from, to } = req.query || {};
      const data = await ReportService.getOverviewReport({ from, to });
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      return res.status(error.status || 500).json({
        success: false,
        status: error.status || 500,
        code: error.code || "SERVER_ERROR",
        message: error.message,
      });
    }
  },

  /**
   * Reporte de suscripciones vigentes vs vencidas y desglose por plan.
   */
  async getSubscriptionsReport(req, res) {
    try {
      const { from, to } = req.query || {};
      const data = await ReportService.getSubscriptionsReport({ from, to });
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      return res.status(error.status || 500).json({
        success: false,
        status: error.status || 500,
        code: error.code || "SERVER_ERROR",
        message: error.message,
      });
    }
  },

  /**
   * Reporte financiero y desglose mensual de ingresos por pagos aprobados.
   */
  async getRevenueReport(req, res) {
    try {
      const { from, to } = req.query || {};
      const data = await ReportService.getRevenueReport({ from, to });
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      return res.status(error.status || 500).json({
        success: false,
        status: error.status || 500,
        code: error.code || "SERVER_ERROR",
        message: error.message,
      });
    }
  },

  /**
   * Reporte de usuarios, distribución por estado y rol.
   */
  async getUsersReport(req, res) {
    try {
      const { from, to } = req.query || {};
      const data = await ReportService.getUsersReport({ from, to });
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      return res.status(error.status || 500).json({
        success: false,
        status: error.status || 500,
        code: error.code || "SERVER_ERROR",
        message: error.message,
      });
    }
  },

  /**
   * Reporte de capacidad y almacenamiento global y por usuario.
   */
  async getStorageReport(req, res) {
    try {
      const data = await ReportService.getStorageReport();
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      return res.status(error.status || 500).json({
        success: false,
        status: error.status || 500,
        code: error.code || "SERVER_ERROR",
        message: error.message,
      });
    }
  },

  /**
   * Exportación de reportes a CSV o PDF con cabeceras de descarga.
   * Sanitización contra inyección de fórmulas CSV y buffer en memoria para PDF.
   */
  async exportReport(req, res) {
    try {
      const { type, format = "csv", from, to } = req.query || {};

      if (!type) {
        return res.status(400).json({
          success: false,
          status: 400,
          code: "INVALID_REPORT_TYPE",
          message: "Debe especificar el parámetro 'type' (subscriptions, revenue, storage, users u overview)",
        });
      }

      const normalizedFormat = String(format).toLowerCase();
      if (!["csv", "pdf"].includes(normalizedFormat)) {
        return res.status(400).json({
          success: false,
          status: 400,
          code: "INVALID_EXPORT_FORMAT",
          message: "El formato debe ser 'csv' o 'pdf'",
        });
      }

      const result = await ReportService.exportReport({
        type,
        format: normalizedFormat,
        from,
        to,
      });

      res.setHeader("Content-Type", result.contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);

      if (normalizedFormat === "pdf") {
        return res.end(result.buffer);
      } else {
        return res.send(result.data);
      }
    } catch (error) {
      return res.status(error.status || 500).json({
        success: false,
        status: error.status || 500,
        code: error.code || "SERVER_ERROR",
        message: error.message,
      });
    }
  },
};

module.exports = reportController;
