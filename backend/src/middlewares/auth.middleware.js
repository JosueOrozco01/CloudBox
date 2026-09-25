const supabase = require('../config/supabase');
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Token de autenticación no proporcionado'
            });
        }

        const token = authHeader.split(' ')[1];

        // 1. Validar JWT con Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.getUser(token);

        if (authError || !authData?.user) {
            return res.status(401).json({
                success: false,
                message: 'Sesión inválida o expirada'
            });
        }

        // 2. Consultar tabla física de usuario
        const { data: userData, error: dbError } = await supabaseAdmin
            .from('usuario')
            .select('id, auth_user_id, nombre, apellido, correo, id_rol, id_estado, fecha_registro')
            .eq('auth_user_id', authData.user.id)
            .single();

        if (dbError || !userData) {
            return res.status(401).json({
                success: false,
                message: 'Sesión inválida o expirada'
            });
        }

        // 3. Validar estado de la cuenta
        if (userData.id_estado !== 1) {
            return res.status(403).json({
                success: false,
                message: 'Cuenta inactiva o suspendida'
            });
        }

        // Adjuntar información completa a req.user
        req.user = userData;
        // Keep the token in req if needed for signOutUser
        req.token = token;

        next();
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error interno de autenticación'
        });
    }
};

module.exports = authenticateToken;