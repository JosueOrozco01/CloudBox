const supabase = require('../config/supabase');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

const requestPasswordRecovery = async (email) => {
    const normalizedEmail = email.trim().toLowerCase();

    const { error } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        {
            redirectTo: process.env.PASSWORD_RESET_REDIRECT_URL
        }
    );

    if (error) {
        if (
            error.status === 429 ||
            error.code === 'over_email_send_rate_limit'
        ) {
            const rateLimitError =
                new Error('Password recovery email rate limit exceeded');

            rateLimitError.code = 'PASSWORD_RECOVERY_RATE_LIMIT';
            rateLimitError.status = 429;
            rateLimitError.cause = error;

            throw rateLimitError;
        }

        const passwordRecoveryError =
            new Error('Unable to request password recovery');

        passwordRecoveryError.code = 'PASSWORD_RECOVERY_FAILED';
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
                new Error('Email confirmation rate limit exceeded');

            rateLimitError.code = 'EMAIL_CONFIRMATION_RATE_LIMIT';
            rateLimitError.status = 429;
            rateLimitError.cause = error;

            throw rateLimitError;
        }

        const confirmationError =
            new Error('Unable to resend email confirmation');

        confirmationError.code = 'EMAIL_CONFIRMATION_FAILED';
        confirmationError.status = 500;
        confirmationError.cause = error;

        throw confirmationError;
    }
};
const registrarUsuario = async (dto) => {
  const { firstName, lastName, email, password } = dto;
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Validar duplicado ANTES de llamar a Supabase Auth
  const { data: usuarioExistente } = await supabaseAdmin
    .from('usuario')
    .select('id')
    .eq('correo', normalizedEmail)
    .maybeSingle();

  if (usuarioExistente) {
    const err = new Error('El correo electrónico ya se encuentra registrado');
    err.status = 409;
    throw err;
  }

  // 2. Registro en Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: normalizedEmail,
    password
  });

  if (authError) {
    throw authError;
  }

  // 3. Persistencia en la tabla física usuario
  // Intentar inserción; si choca por un trigger existente, actualizar nombre y apellido
  const { error: insertError } = await supabaseAdmin
    .from('usuario')
    .insert({
      nombre: firstName,
      apellido: lastName,
      correo: normalizedEmail,
      espacio_usado_by: 0,
      fecha_registro: new Date().toISOString().split('T')[0],
      id_rol: 1,
      id_estado: 1,
      auth_user_id: authData.user?.id
    });

  if (insertError) {
    if (insertError.code === '23505') {
      // Si el trigger de la base de datos lo auto-insertó, completamos los nombres
      await supabaseAdmin
        .from('usuario')
        .update({
          nombre: firstName,
          apellido: lastName,
          auth_user_id: authData.user?.id
        })
        .eq('correo', normalizedEmail);
    } else {
      throw insertError;
    }
  }

  return {
    message: "Revisa tu correo para verificar tu cuenta"
  };
};

// Export services only after they have been initialized.
module.exports = {
    registrarUsuario,
    requestPasswordRecovery,
    resendEmailConfirmation
};