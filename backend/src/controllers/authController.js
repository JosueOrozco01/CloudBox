const SessionHistory = require('../services/session-history.service');
const { registrarUsuario, verificarCorreo, iniciarSesion, requestPasswordRecovery, resetPassword, signOutUser } = require('../services/auth.service');

const register = async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body;
        
        await registrarUsuario({ firstName, lastName, email, password });
        
        return res.status(201).json({
            message: 'Revisa tu correo para verificar tu cuenta'
        });
    } catch (error) {
        return res.status(error.status || 500).json({
            success: false,
            message: error.message || 'Error registrando al usuario'
        });
    }
};
const verifyEmail = async (req, res) => {
    try {
        // Permit payload from body (POST) or query string (GET)
        const payload = Object.keys(req.body || {}).length > 0 ? req.body : req.query;
        const { token, email, type } = payload;
        
        await verificarCorreo({ token, email, type });
        
        return res.status(200).json({
            message: "Cuenta verificada correctamente"
        });
    } catch (error) {
        return res.status(error.status || 400).json({
            success: false,
            message: error.message || 'El enlace de verificación no es válido o ha vencido'
        });
    }
};
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const sessionData = await iniciarSesion({ email, password });
        await SessionHistory.recordLogin(req, sessionData.user.id, sessionData.token);
        
        return res.status(200).json({
            success: true,
            token: sessionData.token,
            refreshToken: sessionData.refreshToken,
            user: sessionData.user
        });
    } catch (error) {
        return res.status(error.status || 500).json({
            success: false,
            message: error.message || 'Error al iniciar sesión'
        });
    }
};

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        
        await requestPasswordRecovery(email);
        
        return res.status(200).json({
            success: true,
            message: "Se ha enviado un código a tu correo electrónico"
        });
    } catch (error) {
        return res.status(error.status || 500).json({
            success: false,
            message: error.message || 'No se pudo procesar la solicitud'
        });
    }
};

const resetPasswordController = async (req, res) => {
    try {
        const { email, token, newPassword } = req.body;
        
        const result = await resetPassword({ email, token, newPassword });
        
        return res.status(200).json({
            success: true,
            message: result.message
        });
    } catch (error) {
        return res.status(error.status || 500).json({
            success: false,
            message: error.message || 'Error al restablecer la contraseña'
        });
    }
};

const logout = async (req, res) => {
    try {
        const { accessToken, refreshToken } = req.body;

        await signOutUser(accessToken, refreshToken);
        await SessionHistory.recordLogout(req, accessToken);

        return res.status(200).json({
            success: true,
            message: 'Sesión cerrada correctamente'
        });
    } catch (error) {
        return res.status(error.status || 500).json({
            success: false,
            message: error.message || 'No se pudo cerrar la sesión'
        });
    }
};

module.exports = {
    register,
    verifyEmail,
    login,
    forgotPassword,
    resetPassword: resetPasswordController,
    logout
};