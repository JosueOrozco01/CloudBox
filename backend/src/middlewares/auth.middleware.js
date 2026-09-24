const supabase = require('../config/supabase');
const createAuthenticatedSupabaseClient = require('../config/authenticated-supabase');

const requireAuth = async (req, res, next) => {
    try {
        const authorizationHeader = req.headers.authorization;

        if (!authorizationHeader) {
            return res.status(401).json({
                success: false,
                message: 'Authorization token is required'
            });
        }

        const [scheme, token] = authorizationHeader.split(' ');

        if (scheme !== 'Bearer' || !token) {
            return res.status(401).json({
                success: false,
                message: 'Invalid authorization format'
            });
        }

        const { data: authData, error: authError } =
            await supabase.auth.getUser(token);

        if (authError || !authData.user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }

        // Use the user's JWT so database queries respect Row Level Security policies.
        const authenticatedSupabase =
            createAuthenticatedSupabaseClient(token);

        const { data: userProfile, error: profileError } =
            await authenticatedSupabase
                .from('usuario')
                .select(`
          id,
          auth_user_id,
          nombre,
          apellido,
          correo,
          id_rol,
          id_estado
        `)
                .eq('auth_user_id', authData.user.id)
                .single();

        if (profileError || !userProfile) {
            return res.status(403).json({
                success: false,
                message: 'CloudBox user profile was not found'
            });
        }

        const { data: role, error: roleError } =
            await authenticatedSupabase
                .from('rol')
                .select('id, nombre')
                .eq('id', userProfile.id_rol)
                .single();

        if (roleError || !role) {
            return res.status(403).json({
                success: false,
                message: 'User role was not found'
            });
        }

        const { data: userStatus, error: statusError } =
            await authenticatedSupabase
                .from('estado_usuario')
                .select('id, nombre')
                .eq('id', userProfile.id_estado)
                .single();

        if (statusError || !userStatus) {
            return res.status(403).json({
                success: false,
                message: 'User status was not found'
            });
        }

        if (userStatus.nombre.toLowerCase() !== 'activo') {
            return res.status(403).json({
                success: false,
                message: 'User account is not active'
            });
        }

        req.authUser = authData.user;

        req.user = {
            id: userProfile.id,
            authUserId: userProfile.auth_user_id,
            firstName: userProfile.nombre,
            lastName: userProfile.apellido,
            email: userProfile.correo,
            role: role.nombre,
            status: userStatus.nombre
        };

        next();
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Authentication validation failed'
        });
    }
};

module.exports = requireAuth;