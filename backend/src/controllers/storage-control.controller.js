const QuotaService = require('../services/quota.service');

const StorageControlController = {
  async getQuotaSummary(req, res, next) {
    try {
      const summary = await QuotaService.getQuotaSummary(req.user.id);
      return res.status(200).json({
        success: true,
        message: 'Resumen de cuota obtenido exitosamente',
        data: summary
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = StorageControlController;
