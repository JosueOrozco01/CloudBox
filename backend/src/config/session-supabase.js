const { createClient } = require('@supabase/supabase-js');

const createSessionSupabaseClient = () => {
    return createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
            }
        }
    );
};

module.exports = createSessionSupabaseClient;