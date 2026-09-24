const supabase = require('../config/supabase');

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

// Export services only after they have been initialized.
module.exports = {
    requestPasswordRecovery,
    resendEmailConfirmation
};