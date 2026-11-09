function validateEnvironment(env = process.env) {
  const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
  const missing = required.filter(name => !env[name]);
  if (!env.SUPABASE_SECRET_KEY && !env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (env.NODE_ENV === 'production' && !env.CORS_ORIGINS) missing.push('CORS_ORIGINS');
  if (missing.length) throw new Error('Faltan variables de entorno: ' + missing.join(', '));
  const url = new URL(env.SUPABASE_URL);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('SUPABASE_URL debe ser HTTP o HTTPS.');
  if (env.PORT && (!/^\d+$/.test(env.PORT) || Number(env.PORT)<1 || Number(env.PORT)>65535)) throw new Error('PORT no es válido.');
}
module.exports = { validateEnvironment };
