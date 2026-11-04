// Local protection; a shared gateway must also limit traffic across replicas.
const windows = new Map();
module.exports = (req, res, next) => {
  const now = Date.now();
  for (const [key, window] of windows) if (window.expires <= now) windows.delete(key);
  const keys = ['ip:' + req.ip];
  if (typeof req.body?.email === 'string') keys.push('email:' + req.path + ':' + req.body.email.trim().toLowerCase());
  const emailLimit=['/forgot-password','/resend-verification'].includes(req.path) ? 1 : 10;
  if (keys.some(key => (windows.get(key)?.count || 0) >= (key.startsWith('ip:') ? 100 : emailLimit)) || windows.size + keys.filter(key => !windows.has(key)).length > 10000) {
    res.set('Retry-After', '60');
    return res.status(429).json({ success: false, code: 'AUTH_RATE_LIMIT', message: 'Demasiados intentos. Espera un minuto.' });
  }
  for (const key of keys) { const window = windows.get(key) || {count:0,expires:now+60000}; window.count++; windows.set(key,window); }
  next();
};
