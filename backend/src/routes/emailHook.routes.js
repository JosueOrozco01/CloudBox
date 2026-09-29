const express = require('express');

const router = express.Router();

router.post(
    '/send-auth-email',
    express.text({ type: 'application/json' }),
    async (req, res) => {
        try {
            const { Webhook } = await import('standardwebhooks');

            // Validate the webhook secret
            const secretRaw = (
                process.env.SEND_EMAIL_HOOK_SECRET || ''
            ).trim();

            if (!secretRaw) {
                console.error(
                    'SEND_EMAIL_HOOK_SECRET is not configured'
                );

                return res.status(500).json({
                    error: 'Hook secret is not configured'
                });
            }

            if (!secretRaw.startsWith('v1,whsec_')) {
                console.error(
                    'SEND_EMAIL_HOOK_SECRET has an invalid format'
                );

                return res.status(500).json({
                    error: 'Invalid hook secret'
                });
            }

            const secret = secretRaw.replace(
                /^v1,whsec_/,
                ''
            );

            // Validate webhook headers
            const webhookId =
                req.headers['webhook-id'];

            const webhookTimestamp =
                req.headers['webhook-timestamp'];

            const webhookSignature =
                req.headers['webhook-signature'];

            if (
                !webhookId ||
                !webhookTimestamp ||
                !webhookSignature
            ) {
                console.error(
                    'Missing Standard Webhooks headers'
                );

                return res.status(401).json({
                    error: 'Missing webhook headers'
                });
            }

            // Verify the webhook signature
            const webhook = new Webhook(secret);

            const payload = req.body;

            if (typeof payload !== 'string') {
                console.error(
                    'Webhook body was not received as text'
                );

                return res.status(400).json({
                    error: 'Invalid request body'
                });
            }

            const headers = {
                'webhook-id': webhookId,
                'webhook-timestamp': webhookTimestamp,
                'webhook-signature': webhookSignature
            };

            const {
                user,
                email_data
            } = webhook.verify(
                payload,
                headers
            );

            console.log(
                'Send Email Hook signature verified successfully'
            );

            if (!user?.email) {
                console.error(
                    'Recipient email is missing'
                );

                return res.status(400).json({
                    error: 'Recipient email is missing'
                });
            }

            // Get email information
            const {
                token,
                token_hash,
                redirect_to,
                site_url,
                email_action_type
            } = email_data;

            let subject = 'CloudBox';
            let title = 'CloudBox';
            let message = '';
            let buttonText = 'Continuar';
            let actionUrl = '';
            let recoveryCode = '';

            let codeDisplay = 'none';
            let buttonDisplay = 'block';

            // Signup confirmation email
            if (email_action_type === 'signup') {
                const destination =
                    redirect_to ||
                    process.env.EMAIL_CONFIRMATION_REDIRECT_URL ||
                    site_url ||
                    'http://localhost:5173/login';

                subject =
                    'Confirma tu cuenta de CloudBox';

                title =
                    'Confirma tu correo electrónico';

                message =
                    'Gracias por registrarte en CloudBox. Confirma tu correo electrónico para activar tu cuenta.';

                buttonText =
                    'Confirmar mi cuenta';

                actionUrl =
                    `${process.env.SUPABASE_URL}/auth/v1/verify` +
                    `?token=${encodeURIComponent(token_hash)}` +
                    `&type=signup` +
                    `&redirect_to=${encodeURIComponent(destination)}`;

                codeDisplay = 'none';
                buttonDisplay = 'block';
            }

            // Password recovery email
            if (email_action_type === 'recovery') {
                if (!token) {
                    console.error(
                        'Recovery OTP was not provided by Supabase'
                    );

                    return res.status(500).json({
                        error: 'Recovery OTP is missing'
                    });
                }

                subject =
                    'Código para restablecer tu contraseña';

                title =
                    'Restablece tu contraseña';

                message =
                    'Ingresa este código en CloudBox para restablecer la contraseña de tu cuenta.';

                recoveryCode = token;

                codeDisplay = 'block';
                buttonDisplay = 'none';

                actionUrl =
                    process.env.PASSWORD_RESET_REDIRECT_URL ||
                    'http://localhost:5173/reset-password';
            }

            // Magic link email
            if (email_action_type === 'magiclink') {
                const destination =
                    redirect_to ||
                    site_url ||
                    'http://localhost:5173';

                subject =
                    'Acceso a CloudBox';

                title =
                    'Iniciar sesión';

                message =
                    'Utiliza el siguiente enlace para ingresar a tu cuenta de CloudBox.';

                buttonText =
                    'Iniciar sesión';

                actionUrl =
                    `${process.env.SUPABASE_URL}/auth/v1/verify` +
                    `?token=${encodeURIComponent(token_hash)}` +
                    `&type=magiclink` +
                    `&redirect_to=${encodeURIComponent(destination)}`;

                codeDisplay = 'none';
                buttonDisplay = 'block';
            }

            // Send the email using EmailJS
            const emailResponse = await fetch(
                'https://api.emailjs.com/api/v1.0/email/send',
                {
                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'application/json'
                    },

                    body: JSON.stringify({
                        service_id:
                            process.env.EMAILJS_SERVICE_ID,

                        template_id:
                            process.env.EMAILJS_TEMPLATE_ID,

                        user_id:
                            process.env.EMAILJS_PUBLIC_KEY,

                        template_params: {
                            to_email: user.email,
                            email: user.email,
                            subject,
                            title,
                            message,
                            button_text: buttonText,
                            action_url: actionUrl,
                            code: recoveryCode,
                            code_display: codeDisplay,
                            button_display: buttonDisplay
                        }
                    })
                }
            );

            if (!emailResponse.ok) {
                const emailError =
                    await emailResponse.text();

                console.error(
                    'EmailJS error:',
                    emailError
                );

                return res.status(500).json({
                    error: 'Unable to send email'
                });
            }

            console.log(
                `${email_action_type} email sent to ${user.email}`
            );

            return res.status(200).json({});
        } catch (error) {
            console.error(
                'Send Email Hook error:',
                error.message
            );

            return res.status(401).json({
                error: 'Invalid webhook'
            });
        }
    }
);

module.exports = router;