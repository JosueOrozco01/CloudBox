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

    console.log('Autenticación de prueba correcta. Los tokens no se muestran.');
};

getAuthToken().catch(() => {
    console.error('No se pudo autenticar la cuenta de prueba.');
    process.exitCode = 1;
});
