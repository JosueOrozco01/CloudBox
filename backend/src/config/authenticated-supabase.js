const { createClient } = require('@supabase/supabase-js');

const createAuthenticatedSupabaseClient = (accessToken) => {
    return createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY,
        {
            global: {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            },
            auth: {
                persistSession: false,
                autoRefreshToken: false
            }
        }
    );
};

module.exports = createAuthenticatedSupabaseClient;