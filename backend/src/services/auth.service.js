const supabase = require('../config/supabase');
const createSessionSupabaseClient = require('../config/session-supabase');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const requestPasswordRecovery = async (email) => {
    const normalizedEmail = email.trim().toLowerCase();

    const { error } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        {
            redirectTo:
                process.env.PASSWORD_RESET_REDIRECT_URL
        }
    );

    if (error) {
        if (
            error.status === 429 ||
            error.code === 'over_email_send_rate_limit'
        ) {
            const rateLimitError =
                new Error(
                    'Password recovery email rate limit exceeded'
                );

            rateLimitError.code =
                'PASSWORD_RECOVERY_RATE_LIMIT';

            rateLimitError.status = 429;
            rateLimitError.cause = error;

            throw rateLimitError;
        }

        const passwordRecoveryError =
            new Error(
                'Unable to request password recovery'
            );

        passwordRecoveryError.code =
            'PASSWORD_RECOVERY_FAILED';

        passwordRecoveryError.status = 500;
        passwordRecoveryError.cause = error;

        throw passwordRecoveryError;
    }
};

const resendEmailConfirmation = async (email) => {
    const normalizedEmail = email.trim().toLowerCase();

    const { error } = await supabase.auth.resend({
        type: 'signup',
        email: normalizedEmail,
        options: {
            emailRedirectTo:
                process.env.EMAIL_CONFIRMATION_REDIRECT_URL
        }
    });

    if (error) {
        if (
            error.status === 429 ||
            error.code === 'over_email_send_rate_limit'
        ) {
            const rateLimitError =
                new Error(
                    'Email confirmation rate limit exceeded'
                );

            rateLimitError.code =
                'EMAIL_CONFIRMATION_RATE_LIMIT';

            rateLimitError.status = 429;
            rateLimitError.cause = error;

            throw rateLimitError;
        }

        const confirmationError =
            new Error(
                'Unable to resend email confirmation'
            );

        confirmationError.code =
            'EMAIL_CONFIRMATION_FAILED';

        confirmationError.status = 500;
        confirmationError.cause = error;

        throw confirmationError;
    }
};

const signOutUser = async (
    accessToken,
    refreshToken
) => {
    if (!accessToken || !refreshToken) {
        const sessionError =
            new Error(
                'Access token and refresh token are required'
            );

        sessionError.code =
            'SESSION_TOKENS_REQUIRED';

        sessionError.status = 400;

        throw sessionError;
    }

    const sessionSupabase =
        createSessionSupabaseClient();

    const { error: sessionError } =
        await sessionSupabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
        });

    if (sessionError) {
        const invalidSessionError =
            new Error(
                'Unable to restore user session'
            );

        invalidSessionError.code =
            'INVALID_SESSION';

        invalidSessionError.status = 401;
        invalidSessionError.cause =
            sessionError;

        throw invalidSessionError;
    }

    const { error: signOutError } =
        await sessionSupabase.auth.signOut({
            scope: 'local'
        });

    if (signOutError) {
        const logoutError =
            new Error(
                'Unable to sign out user'
            );

        logoutError.code =
            'AUTH_SIGN_OUT_FAILED';

        logoutError.status = 500;
        logoutError.cause =
            signOutError;

        throw logoutError;
    }
};

const registrarUsuario = async (dto) => {
    const {
        firstName,
        lastName,
        email,
        password
    } = dto;

    const normalizedEmail =
        email.trim().toLowerCase();

    // Validate duplicate email before calling Supabase Auth
    const { data: usuarioExistente } =
        await supabaseAdmin
            .from('usuario')
            .select('id')
            .eq('correo', normalizedEmail)
            .maybeSingle();

    if (usuarioExistente) {
        const err =
            new Error(
                'El correo electrónico ya se encuentra registrado'
            );

        err.status = 409;

        throw err;
    }

    // Register user in Supabase Auth
    const {
        data: authData,
        error: authError
    } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
            emailRedirectTo:
                process.env.EMAIL_CONFIRMATION_REDIRECT_URL
        }
    });

    if (authError) {
        throw authError;
    }

    // Persist record in physical usuario table
    const { error: insertError } =
        await supabaseAdmin
            .from('usuario')
            .insert({
                nombre: firstName,
                apellido: lastName,
                correo: normalizedEmail,
                espacio_usado_by: 0,
                fecha_registro:
                    new Date()
                        .toISOString()
                        .split('T')[0],
                id_rol: 1,
                id_estado: 1,
                auth_user_id:
                    authData.user?.id
            });

    if (insertError) {
        if (insertError.code === '23505') {
            await supabaseAdmin
                .from('usuario')
                .update({
                    nombre: firstName,
                    apellido: lastName,
                    auth_user_id:
                        authData.user?.id
                })
                .eq(
                    'correo',
                    normalizedEmail
                );
        } else {
            throw insertError;
        }
    }

    return {
        message:
            'Revisa tu correo para verificar tu cuenta'
    };
};

const verificarCorreo = async ({
    token,
    email,
    type = 'signup'
}) => {
    let verifyOptions = {
        type
    };

    if (token && token.length > 10) {
        verifyOptions.token_hash =
            token;
    } else {
        verifyOptions.token =
            token;

        verifyOptions.email =
            email
                ?.trim()
                .toLowerCase();
    }

    const {
        data,
        error
    } = await supabase.auth.verifyOtp(
        verifyOptions
    );

    if (error) {
        const err =
            new Error(
                'El enlace de verificación no es válido o ha vencido'
            );

        err.status = 400;

        throw err;
    }

    return {
        message:
            'Cuenta verificada correctamente'
    };
};

const iniciarSesion = async ({
    email,
    password
}) => {
    const normalizedEmail =
        email.trim().toLowerCase();

    // Validate credentials against Supabase Auth
    const {
        data: authData,
        error: authError
    } =
        await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password
        });

    if (authError) {
        const err =
            new Error(
                'Credenciales inválidas o cuenta no verificada'
            );

        err.status = 401;

        throw err;
    }

    // Fetch user profile from physical database
    const {
        data: userData,
        error: dbError
    } =
        await supabaseAdmin
            .from('usuario')
            .select(
                'id, nombre, apellido, correo, id_rol, id_estado'
            )
            .eq(
                'auth_user_id',
                authData.user.id
            )
            .single();

    if (dbError || !userData) {
        const err =
            new Error(
                'No se pudo recuperar la información del usuario'
            );

        err.status = 500;

        throw err;
    }

    if (userData.id_estado !== 1) {
        const err =
            new Error(
                'Cuenta inactiva'
            );

        err.status = 401;

        throw err;
    }

    return {
        token:
            authData.session.access_token,

        refreshToken:
            authData.session.refresh_token,

        user: {
            id: userData.id,
            nombre: userData.nombre,
            apellido: userData.apellido,
            correo: userData.correo,
            rol: userData.id_rol
        }
    };
};

const resetPassword = async ({
    email,
    token,
    newPassword
}) => {
    // Validate minimum password requirements
    const passwordRegex =
        /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

    if (!passwordRegex.test(newPassword)) {
        const err =
            new Error(
                'La contraseña debe tener al menos 8 caracteres, una mayúscula, un número y un símbolo'
            );

        err.status = 400;

        throw err;
    }

    let verifyOptions = {
        type: 'recovery'
    };

    if (token && token.length > 10) {
        verifyOptions.token_hash =
            token;
    } else {
        verifyOptions.token =
            token;

        verifyOptions.email =
            email
                ?.trim()
                .toLowerCase();
    }

    const {
        data: verifyData,
        error: verifyError
    } =
        await supabase.auth.verifyOtp(
            verifyOptions
        );

    if (
        verifyError ||
        !verifyData?.user
    ) {
        const err =
            new Error(
                'El código de recuperación es inválido o ha vencido'
            );

        err.status = 400;

        throw err;
    }

    const { error: updateError } =
        await supabaseAdmin.auth.admin.updateUserById(
            verifyData.user.id,
            {
                password:
                    newPassword
            }
        );

    if (updateError) {
        const err =
            new Error(
                'No se pudo actualizar la contraseña'
            );

        err.status = 500;

        throw err;
    }

    return {
        message:
            'Contraseña restablecida exitosamente'
    };
};

module.exports = {
    registrarUsuario,
    verificarCorreo,
    iniciarSesion,
    requestPasswordRecovery,
    resendEmailConfirmation,
    resetPassword,
    signOutUser
};