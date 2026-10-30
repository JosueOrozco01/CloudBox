const service = require('../services/notification.service');
const { pagination } = require('../services/history-validation');
const handle = operation => async (req, res, next) => {
  try { await operation(req, res); } catch (error) { next(error); }
};
const list = unread => handle(async (req, res) => {
  const page = pagination(req.query);
  const data = await service.listNotifications(req.user.id, page, unread);
  res.json({ success: true, data, pagination: page });
});
module.exports = {
  list: list(false), unread: list(true),
  read: handle(async (req, res) => res.json({ success: true, data: await service.markRead(req.user.id, req.params.id) })),
  readAll: handle(async (req, res) => res.json({ success: true, data: await service.markAllRead(req.user.id) })),
  remove: handle(async (req, res) => { await service.deleteNotification(req.user.id, req.params.id); res.status(204).end(); })
};
