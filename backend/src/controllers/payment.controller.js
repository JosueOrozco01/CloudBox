const Payments = require('../services/payment-simulator.service');
const controller = {
  async process(req, res, next) {
    try {
      const { subscriptionId, planId, paymentMethodId, referenceCode, simulateFailure } = req.body || {};
      const data = await Payments.processSimulatedPayment({
        userId: req.user.id, subscriptionId, planId, paymentMethodId, referenceCode, simulateFailure
      });
      res.status(data.success ? 201 : 402).json({ success: data.success,
        ...(data.success ? {} : { code: 'PAYMENT_DECLINED' }),
        message: data.success ? 'Pago simulado aprobado' : 'Pago simulado rechazado', data });
    } catch (error) { next(error); }
  },
  async methods(req, res, next) {
    try { res.json({ success: true, data: await Payments.getMethods() }); } catch (error) { next(error); }
  },
  async history(req, res, next) {
    try { res.json({ success: true, data: await Payments.getHistory(req.user.id) }); } catch (error) { next(error); }
  },
  async byId(req, res, next) {
    try { res.json({ success: true, data: await Payments.getById({
      paymentId: req.params.id, userId: req.user.id, userRole: req.user.role
    }) }); } catch (error) { next(error); }
  }
};
module.exports = controller;
