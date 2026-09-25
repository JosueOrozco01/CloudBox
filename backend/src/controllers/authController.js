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

const { registrarUsuario } = require('../services/auth.service');

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

module.exports = {
    register
};