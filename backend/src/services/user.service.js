const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Updates the user's profile with the allowed editable fields.
 *
 * @param {number} userId - The internal user ID (from PostgreSQL).
 * @param {Object} data - An object containing the fields to update (nombre, apellido).
 * @returns {Object} The updated user profile object.
 */
const updateProfile = async (userId, data) => {
    const { nombre, apellido } = data;
    
    // Only allow update of specific fields
    const updatePayload = {};
    if (nombre !== undefined) updatePayload.nombre = nombre;
    if (apellido !== undefined) updatePayload.apellido = apellido;
    
    if (Object.keys(updatePayload).length === 0) {
        const err = new Error('No hay campos válidos para actualizar');
        err.status = 400;
        throw err;
    }
    
    const { data: updatedData, error } = await supabaseAdmin
        .from('usuario')
        .update(updatePayload)
        .eq('id', userId)
        .select('id, nombre, apellido, correo, fecha_registro, id_rol')
        .single();
        
    if (error || !updatedData) {
        const err = new Error('No se pudo actualizar la información del perfil');
        err.status = 500;
        throw err;
    }
    
    return {
        id: updatedData.id,
        nombre: updatedData.nombre,
        apellido: updatedData.apellido,
        correo: updatedData.correo,
        fecha_registro: updatedData.fecha_registro,
        rol: updatedData.id_rol
    };
};

module.exports = {
    updateProfile
};
