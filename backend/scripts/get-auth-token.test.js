require('dotenv').config();

const supabase = require('../src/config/supabase');

const getAuthToken = async () => {
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;

    if (!testEmail || !testPassword) {
        throw new Error('Missing test user credentials');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword
    });

    if (error) {
        throw new Error(error.message);
    }

    if (!data.session) {
        throw new Error('Authentication session was not created');
    }

    console.log('Authentication successful');

    console.log('\nAccess token:\n');
    console.log(data.session.access_token);

    console.log('\nRefresh token:\n');
    console.log(data.session.refresh_token);
};

getAuthToken().catch((error) => {
    console.error('Authentication failed:', error.message);
});