'use strict';
const Subscriptions = require('../services/subscription.service');

module.exports = {
  async current(req, res, next) {
    try {
      const data = await Subscriptions.getCurrent(req.user.id);
      return res.status(200).json({ success: true, data });
    } catch (error) { return next(error); }
  },
  async subscribe(req, res, next) {
    try {
      const checkout = require('../services/subscription-checkout.service');
      const result = await checkout.subscribePaid(req.user.id, req.body);
      return res.status(result.success ? 201 : 402).json({
        success: result.success,
        ...(result.success ? {} : { code: 'PAYMENT_DECLINED' }),
        data: result
      });
    } catch (error) { return next(error); }
  },
  async history(req, res, next) {
    try {
      const data = await Subscriptions.getHistory(req.user.id);
      return res.status(200).json({ success: true, data });
    } catch (error) { return next(error); }
  }
};
