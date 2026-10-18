const SessionHistory = require('../services/session-history.service');
const { createClient } = require('@supabase/supabase-js');
const UserService = require('../services/user.service');
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const defaults = { theme: 'claro', language: 'Español (América Latina)', showKB: true };
const notificationIds = ['storage', 'renewal', 'shared', 'activity'];
const notifications = saved => notificationIds.map(id => ({ id, enabled: Array.isArray(saved) && saved.some(item => item?.id === id && item.enabled === true) }));
const token = req => req.headers.authorization.slice(7);
module.exports = {
  async getPreferences(req, res) {
    const saved = req.authUser.user_metadata?.cloudbox_preferences || {};
    res.json({ success: true, data: { theme: ['claro', 'oscuro', 'sistema'].includes(saved.theme) ? saved.theme : defaults.theme, language: defaults.language, showKB: typeof saved.showKB === 'boolean' ? saved.showKB : defaults.showKB, notifications: notifications(saved.notifications) } });
  },
  async savePreferences(req, res, next) {
    try {
      const { theme, language, showKB } = req.body || {};
      if (!['claro', 'oscuro', 'sistema'].includes(theme) || language !== defaults.language || typeof showKB !== 'boolean') return res.status(400).json({ success: false, message: 'Las preferencias no son válidas' });
      if (req.body.notifications !== undefined && (!Array.isArray(req.body.notifications) || req.body.notifications.some(item => !item || !notificationIds.includes(item.id) || typeof item.enabled !== 'boolean'))) return res.status(400).json({ success: false, message: 'Las opciones de notificación no son válidas' });
      const preferences = { theme, language, showKB, notifications: notifications(req.body.notifications ?? req.authUser.user_metadata?.cloudbox_preferences?.notifications) };
      const { error } = await admin.auth.admin.updateUserById(req.authUser.id, { user_metadata: { ...req.authUser.user_metadata, cloudbox_preferences: preferences } });
      if (error) throw error;
      res.json({ success: true, data: preferences });
    } catch (error) { next(error); }
  },
  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body || {};
      if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^a-zA-Z0-9\s]/.test(newPassword)) return res.status(400).json({ success: false, message: 'La nueva contraseña debe tener entre 8 y 128 caracteres, una mayúscula, un número y un símbolo' });
      if (currentPassword === newPassword) return res.status(400).json({ success: false, message: 'La nueva contraseña debe ser diferente de la actual' });
      if (!await UserService.verifyCurrentPassword(req.authUser, currentPassword)) return res.status(400).json({ success: false, message: 'La contraseña actual es incorrecta' });
      const { error } = await admin.auth.admin.updateUserById(req.authUser.id, { password: newPassword });
      if (error) return res.status(400).json({ success: false, message: 'No se pudo cambiar la contraseña. Verifica que cumpla los requisitos y no sea una contraseña anterior.' });
      res.json({ success: true, data: { message: 'Contraseña actualizada correctamente' } });
    } catch (error) { next(error); }
  },
  async security(req, res, next) {
    try { res.json({ success: true, data: { sessions: await SessionHistory.list(req, token(req)) } }); }
    catch (error) { next(error); }
  },
  async logoutOthers(req, res, next) {
    try {
      const { error } = await admin.auth.admin.signOut(token(req), 'others');
      if (error) throw error;
      await SessionHistory.recordCloseOthers(req, token(req));
      res.json({ success: true, data: { message: 'Se cerraron las demás sesiones. Los accesos ya emitidos pueden seguir vigentes hasta su vencimiento.' } });
    } catch (error) { next(error); }
  },
};
