/*
 * CloudBox - Controlador de Usuarios
 *
 * Este archivo contiene la lógica relacionada con las operaciones
 * que se pueden realizar sobre los usuarios.
 *
 * Ejemplos:
 * - Crear usuario.
 * - Obtener información del usuario.
 * - Actualizar información.
 * - Consultar usuario por correo.
 * - Actualizar contraseña.
 *
 * Este controlador recibe las solicitudes provenientes de las rutas
 * y utiliza los modelos/servicios correspondientes.
 *
 * La lógica de acceso a la base de datos debe mantenerse separada
 * de las rutas.
 */

const { updateProfile } = require('../services/user.service');

const getProfile = async (req, res) => {
    try {
        const { id, nombre, apellido, correo, fecha_registro, id_rol } = req.user;
        
        return res.status(200).json({
            success: true,
            user: {
                id,
                nombre,
                apellido,
                correo,
                fecha_registro,
                rol: id_rol
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error al obtener el perfil'
        });
    }
};

const updateProfileController = async (req, res) => {
    try {
        const { nombre, apellido } = req.body;
        const userId = req.user.id;
        
        const updatedUser = await updateProfile(userId, { nombre, apellido });
        
        return res.status(200).json({
            success: true,
            message: "Perfil actualizado exitosamente",
            user: updatedUser
        });
    } catch (error) {
        return res.status(error.status || 500).json({
            success: false,
            message: error.message || 'Error al actualizar el perfil'
        });
    }
};

module.exports = {
    getProfile,
    updateProfile: updateProfileController
};