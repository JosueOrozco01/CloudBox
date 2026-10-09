const { createClient } = require('@supabase/supabase-js');

// Igual que los servicios de archivos y carpetas; las consultas del dashboard
// deben filtrar siempre por el ID obtenido del middleware de autenticación.
module.exports = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);
