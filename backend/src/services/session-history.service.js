const { createClient } = require('@supabase/supabase-js');
const { isIP } = require('node:net');
const { recordLog } = require('./audit.service');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const locations = new Map();
function claims(jwt) {
  try { return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()); }
  catch { return {}; }
}
function device(agent = '') {
  const os = /Android/i.test(agent) ? 'Android' : /iPhone|iPad/i.test(agent) ? 'iOS' : /Windows/i.test(agent) ? 'Windows' : /Macintosh|Mac OS/i.test(agent) ? 'macOS' : /Linux/i.test(agent) ? 'Linux' : 'sistema no identificado';
  const browser = /Edg\//.test(agent) ? 'Edge' : /OPR\//.test(agent) ? 'Opera' : /Firefox\//.test(agent) ? 'Firefox' : /Chrome\//.test(agent) ? 'Chrome' : /Safari\//.test(agent) ? 'Safari' : 'Navegador';
  return `${browser} en ${os}`;
}
function publicIP(ip) {
  if (!isIP(ip)) return false;
  if (isIP(ip) === 6) return !/^(::|fc|fd|fe[89ab])/i.test(ip);
  const [a, b] = ip.split('.').map(Number);
  return a !== 0 && a !== 10 && a !== 127 && a < 224 && !(a === 172 && b >= 16 && b <= 31) && !(a === 192 && b === 168) && !(a === 169 && b === 254) && !(a === 100 && b >= 64 && b <= 127);
}
async function locate(ip) {
  const unavailable = { city: null, country: null, location: publicIP(ip) ? 'Ubicación no disponible' : 'Red local o privada' };
  if (!publicIP(ip)) return unavailable;
  const cached = locations.get(ip);
  if (cached && cached.expires > Date.now()) return cached.value;
  let value = unavailable;
  try {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,city,country`, { signal: AbortSignal.timeout(2500), redirect: 'error' });
    if (response.ok) {
      const result = await response.json();
      if (result.success) value = { city: result.city || null, country: result.country || null, location: [result.city, result.country].filter(Boolean).join(', ') || unavailable.location };
    }
  } catch { /* Location failure never prevents sign-in. */ }
  if (locations.size >= 500) locations.delete(locations.keys().next().value);
  locations.set(ip, { value, expires: Date.now() + 3600000 });
  return value;
}
async function current(req, jwt) {
  const payload = claims(jwt);
  const ip = (req.ip || '').replace(/^::ffff:/, '');
  return { id: payload.session_id || 'current', device: device(req.headers['user-agent']), ip, ...await locate(ip), startedAt: req.authUser?.last_sign_in_at || new Date().toISOString(), expiresAt: payload.exp ? payload.exp * 1000 : null, isCurrent: true };
}
module.exports = {
  claims, device, publicIP,
  async recordLogin(req, userId, jwt) {
    try {
      const session = await current(req, jwt);
      if (!claims(jwt).session_id) return;
      await recordLog({ id_usuario: userId, accion: 'SESION_INICIADA', ip_origen: session.ip, detalles: { ...session, resourceName: session.device, description: `Inicio de sesión desde ${session.location}.` } });
    } catch (error) { console.error('Session history could not be recorded:', error.message); }
  },
  async recordLogout(req, jwt) {
    try {
      const payload = claims(jwt);
      if (!payload.session_id || !payload.sub) return;
      const { data, error } = await db.from('usuario').select('id').eq('auth_user_id', payload.sub).maybeSingle();
      if (error || !data) return;
      await recordLog({ id_usuario: data.id, accion: 'SESION_CERRADA', detalles: { sessionId: payload.session_id, description: 'Sesión cerrada.' } });
    } catch (error) { console.error('Session closure could not be recorded:', error.message); }
  },
  async recordCloseOthers(req, jwt) {
    await recordLog({ id_usuario: req.user.id, accion: 'OTRAS_SESIONES_CERRADAS', detalles: { sessionId: claims(jwt).session_id, description: 'Otras sesiones revocadas.' } });
  },
  async list(req, jwt) {
    const session = await current(req, jwt);
    const { data, error } = await db.from('LogAuditoria').select('accion, detalle, fecha').eq('id_usuario', req.user.id).in('accion', ['SESION_INICIADA', 'SESION_CERRADA', 'OTRAS_SESIONES_CERRADAS']).order('fecha', { ascending: false }).order('id', { ascending: false }).limit(100);
    if (error) throw error;
    const sessions = [session], seen = new Set([session.id]), closed = new Set();
    const revocations = [];
    for (const row of data || []) {
      let detail;
      try { detail = typeof row.detalle === 'string' ? JSON.parse(row.detalle) : row.detalle; } catch { continue; }
      if (!detail) continue;
      if (row.accion === 'SESION_CERRADA') { closed.add(detail.sessionId); continue; }
      if (row.accion === 'OTRAS_SESIONES_CERRADAS') { revocations.push({ id: detail.sessionId, date: new Date(row.fecha).getTime() }); continue; }
      if (!detail.id || seen.has(detail.id)) continue;
      seen.add(detail.id);
      if (closed.has(detail.id) || revocations.some(revocation => detail.id !== revocation.id && new Date(row.fecha).getTime() <= revocation.date)) continue;
      if (detail.expiresAt && detail.expiresAt <= Date.now()) continue;
      sessions.push({ id: detail.id, device: detail.device, ip: detail.ip, city: detail.city, country: detail.country, location: detail.location, startedAt: row.fecha, expiresAt: detail.expiresAt, isCurrent: false });
    }
    return sessions;
  },
};
