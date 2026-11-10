const SessionHistory = require('../services/session-history.service');
const { registrarUsuario, verificarCorreo, iniciarSesion, requestPasswordRecovery, resetPassword, signOutUser } = require('../services/auth.service');

const register = async (req, res, next) => {
    try {
        const { firstName, lastName, email, password } = req.body || {};
        
        await registrarUsuario({ firstName, lastName, email, password });
        
        return res.status(201).json({
            message: 'Revisa tu correo para verificar tu cuenta'
        });
    } catch (error) {
        return next(error);
    }
};
const verifyEmail = async (req, res, next) => {
    try {
        // Permit payload from body (POST) or query string (GET)
        const payload = Object.keys(req.body || {}).length > 0 ? req.body : req.query;
        const { token, email, type } = payload;
        
        await verificarCorreo({ token, email, type });
        
        return res.status(200).json({
            message: "Cuenta verificada correctamente"
        });
    } catch (error) {
        return next(error);
    }
};
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body || {};
        
        const sessionData = await iniciarSesion({ email, password });
        await SessionHistory.recordLogin(req, sessionData.user.id, sessionData.token);
        
        return res.status(200).json({
            success: true,
            token: sessionData.token,
            refreshToken: sessionData.refreshToken,
            user: sessionData.user
        });
    } catch (error) {
        return next(error);
    }
};

const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body || {};
        
        await requestPasswordRecovery(email);
        
        return res.status(200).json({
            success: true,
            message: "Si la cuenta existe y permite recuperación, recibirás las instrucciones en tu correo."
        });
    } catch (error) {
        return next(error);
    }
};

const resetPasswordController = async (req, res, next) => {
    try {
        const { email, token, newPassword } = req.body || {};
        
        const result = await resetPassword({ email, token, newPassword });
        
        return res.status(200).json({
            success: true,
            message: result.message
        });
    } catch (error) {
        return next(error);
    }
};

const logout = async (req, res, next) => {
    try {
        const { accessToken, refreshToken } = req.body || {};

        await signOutUser(accessToken, refreshToken);
        await SessionHistory.recordLogout(req, accessToken);

        return res.status(200).json({
            success: true,
            message: 'Sesión cerrada correctamente'
        });
    } catch (error) {
        return next(error);
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
