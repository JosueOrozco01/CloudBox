/*
 * CloudBox - Controlador de Autenticación
 *
 * Este archivo contiene la lógica para:
 *
 * - Registrar nuevos usuarios.
 * - Iniciar sesión.
 * - Verificar credenciales.
 * - Generar tokens de autenticación.
 * - Cerrar sesión cuando corresponda.
 *
 * La contraseña debe verificarse utilizando el mecanismo
 * de hash implementado por el proyecto.
 *
 * Después de un inicio de sesión correcto, el backend debe
 * proporcionar la información necesaria para que el frontend
 * pueda mantener la sesión del usuario.
 */

const { registrarUsuario, verificarCorreo, iniciarSesion } = require('../services/auth.service');

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
        const payload = Object.keys(req.body).length > 0 ? req.body : req.query;
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
        
        return res.status(200).json({
            success: true,
            token: sessionData.token,
            user: sessionData.user
        });
    } catch (error) {
        return res.status(error.status || 500).json({
            success: false,
            message: error.message || 'Error al iniciar sesión'
        });
    }
};

module.exports = {
    register,
    verifyEmail,
    login
};