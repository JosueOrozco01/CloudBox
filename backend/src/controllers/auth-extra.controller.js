const createClient = require('../config/session-supabase');
const requireAuth = require('../middlewares/auth.middleware');
const { resendEmailConfirmation } = require('../services/auth.service');
const attempts = new Map();
exports.refresh = async (req, res, next) => {
  try {
    const refreshToken = req.body?.refreshToken;
    if (typeof refreshToken !== 'string' || refreshToken.length < 8 || refreshToken.length > 4096) return res.status(400).json({ message: 'Sesión inválida.' });
    const { data, error } = await createClient().auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session) return res.status(401).json({ message: 'La sesión venció. Inicia sesión nuevamente.' });
    req.headers.authorization = `Bearer ${data.session.access_token}`;
    return requireAuth(req, res, () => res.json({ success: true, token: data.session.access_token, refreshToken: data.session.refresh_token }));
  } catch (error) { next(error); }
};
exports.resend = async (req, res, next) => {
  try {
    const email = req.body?.email;
    if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Ingresa un correo válido.' });
    const key = `${req.ip}:${email.toLowerCase()}`;
    if (Date.now() - (attempts.get(key) || 0) < 60000) return res.status(429).json({ message: 'Espera un minuto antes de solicitar otro correo.' });
    if (attempts.size > 5000) for (const [id, time] of attempts) if (Date.now() - time > 60000) attempts.delete(id);
    if(attempts.size>=5000)attempts.delete(attempts.keys().next().value);
    attempts.set(key, Date.now());
    await resendEmailConfirmation(email);
    res.json({ success: true, message: 'Si la cuenta necesita verificación, recibirás un correo con las instrucciones.' });
  } catch (error) { next(error); }
};
