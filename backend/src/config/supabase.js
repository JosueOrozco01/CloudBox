const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan las variables de entorno de Supabase');
}

const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);

module.exports = supabase;
