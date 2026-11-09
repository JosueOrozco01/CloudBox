const validation = require('./input-validation');
const createSessionSupabaseClient = require('../config/session-supabase');
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
);

const requestPasswordRecovery = async (email) => {
    const normalizedEmail = validation.email(email);

    const { error } = await createSessionSupabaseClient().auth.resetPasswordForEmail(
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
    const normalizedEmail = validation.email(email);

    const { error } = await createSessionSupabaseClient().auth.resend({
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
    if (typeof accessToken !== 'string' || typeof refreshToken !== 'string' || !accessToken || !refreshToken || accessToken.length > 8192 || refreshToken.length > 4096) {
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
    const firstName = validation.text(dto.firstName, 'El nombre');
    const lastName = validation.text(dto.lastName, 'El apellido');
    const email = validation.email(dto.email);
    const password = validation.password(dto.password);
    const existing = await supabaseAdmin.from('usuario').select('id').eq('correo', email).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) throw Object.assign(new Error('El correo electrónico ya se encuentra registrado.'), {status:409});
    const [role, state] = await Promise.all([
      supabaseAdmin.from('rol').select('id').eq('nombre','Cliente').single(),
      supabaseAdmin.from('estado_usuario').select('id').eq('nombre','Activo').single()
    ]);
    if (role.error || state.error || !role.data || !state.data) throw Object.assign(new Error('El catálogo de registro no está disponible.'),{status:503,code:'REGISTRATION_CATALOG_UNAVAILABLE'});
    const {data, error} = await createSessionSupabaseClient().auth.signUp({email,password,options:{emailRedirectTo:process.env.EMAIL_CONFIRMATION_REDIRECT_URL,data:{nombre:firstName,apellido:lastName}}});
    if (error) throw error;
    if (!data?.user?.id || data.user.identities?.length === 0) throw Object.assign(new Error('La cuenta ya existe. Verifica tu correo o recupera el acceso.'), {status:409});
    const inserted = await supabaseAdmin.from('usuario').insert({
      nombre:firstName,apellido:lastName,correo:email,espacio_usado_by:0,
      fecha_registro:new Date().toISOString().slice(0,10),id_rol:role.data.id,
      id_estado:state.data.id,auth_user_id:data.user.id
    });
    if (inserted.error) {
      // A database trigger or an identical retry may already have created this profile.
      // Never replace another identity just because its email matches.
      const profile = await supabaseAdmin.from('usuario').select('id,correo,auth_user_id').eq('auth_user_id',data.user.id).maybeSingle();
      if (profile.error || !profile.data || profile.data.correo.toLowerCase() !== email) {
        const failure = new Error('No se pudo completar el perfil. Reintenta el registro con el mismo correo.');
        failure.status=503;failure.code='REGISTRATION_PROFILE_PENDING';failure.cause=inserted.error;
        throw failure;
      }
    }
    return {message:'Revisa tu correo para verificar tu cuenta'};
};

const verificarCorreo = async ({
    token,
    email,
    type = 'signup'
}) => {
    if (typeof token !== 'string' || !token || token.length > 4096 || !['signup', 'email'].includes(type)) {
        throw validation.invalid('El código de verificación no es válido.');
    }
    let verifyOptions = {
        type
    };

    if (token && token.length > 10) {
        verifyOptions.token_hash =
            token;
    } else {
        verifyOptions.token =
            token;

        verifyOptions.email = validation.email(email);
    }

    const {
        data,
        error
    } = await createSessionSupabaseClient().auth.verifyOtp(
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
    const normalizedEmail = validation.email(email);

    // Validate credentials against Supabase Auth
    const {
        data: authData,
        error: authError
    } =
        await createSessionSupabaseClient().auth.signInWithPassword({
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
    let {
        data: userData,
        error: dbError
    } =
        await supabaseAdmin
            .from('usuario')
            .select(
                'id, nombre, apellido, correo, id_rol, id_estado, estado:id_estado(nombre)'
            )
            .eq(
                'auth_user_id',
                authData.user.id
            )
            .single();

    if ((!userData && !dbError) || dbError?.code === 'PGRST116') {
        // A verified login can finish this identity's interrupted registration.
        const metadata=authData.user.user_metadata || {};
        if (typeof metadata.nombre !== 'string' || typeof metadata.apellido !== 'string') {
            throw Object.assign(new Error('El perfil de esta cuenta requiere completar el registro.'),{status:503,code:'REGISTRATION_PROFILE_PENDING'});
        }
        const firstName=validation.text(metadata.nombre,'El nombre');
        const lastName=validation.text(metadata.apellido,'El apellido');
        const [role,state]=await Promise.all([
            supabaseAdmin.from('rol').select('id').eq('nombre','Cliente').single(),
            supabaseAdmin.from('estado_usuario').select('id').eq('nombre','Activo').single()
        ]);
        if(role.error || state.error || !role.data || !state.data) throw Object.assign(new Error('No se pudo completar el perfil.'),{status:503,code:'REGISTRATION_PROFILE_PENDING'});
        const inserted=await supabaseAdmin.from('usuario').insert({nombre:firstName,apellido:lastName,correo:normalizedEmail,auth_user_id:authData.user.id,id_rol:role.data.id,id_estado:state.data.id,espacio_usado_by:0,fecha_registro:new Date().toISOString().slice(0,10)});
        if(inserted.error && inserted.error.code !== '23505') throw Object.assign(new Error('No se pudo completar el perfil.'),{status:503,code:'REGISTRATION_PROFILE_PENDING'});
        const profile=await supabaseAdmin.from('usuario').select('id,nombre,apellido,correo,id_rol,id_estado,estado:id_estado(nombre)').eq('auth_user_id',authData.user.id).single();
        userData=profile.data;dbError=profile.error;
    }

    if (dbError || !userData) {
        const err =
            new Error(
                'No se pudo recuperar la información del usuario'
            );

        err.status = 500;

        throw err;
    }

    if (userData.estado?.nombre !== 'Activo') {
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
    validation.password(newPassword);
    validation.email(email);
    if (typeof token !== 'string' || !token || token.length > 4096) throw validation.invalid('El código de recuperación no es válido.');

    let verifyOptions = {
        type: 'recovery'
    };

    if (token && token.length > 10) {
        verifyOptions.token_hash =
            token;
    } else {
        verifyOptions.token =
            token;

        verifyOptions.email = validation.email(email);
    }

    const {
        data: verifyData,
        error: verifyError
    } =
        await createSessionSupabaseClient().auth.verifyOtp(
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
