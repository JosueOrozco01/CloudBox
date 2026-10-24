'use strict';
const receipts = require('../services/receipt.service');
const opts = req => ({ paymentId: req.params.id, userId: req.user.id, userRole: req.user.role });
module.exports = {
  async details(req, res, next) {
    try { res.status(200).json({ success: true, data: await receipts.ensureReceipt(opts(req)) }); }
    catch (error) { next(error); }
  },
  async download(req, res, next) {
    try { res.status(200).json({ success: true, data: await receipts.getDownload(opts(req)) }); }
    catch (error) { next(error); }
  }
};
