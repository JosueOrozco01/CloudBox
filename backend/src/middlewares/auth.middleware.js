const supabase = require('../config/supabase');
const createAuthenticatedSupabaseClient =
    require('../config/authenticated-supabase');

const requireAuth = async (req, res, next) => {
    try {
        const authorizationHeader = req.headers.authorization;

        if (!authorizationHeader) {
            return res.status(401).json({
                success: false,
                code: 'AUTH_TOKEN_REQUIRED',
                message: 'Authorization token is required'
            });
        }

        const [scheme, token] = authorizationHeader.split(' ');

        if (scheme !== 'Bearer' || !token) {
            return res.status(401).json({
                success: false,
                code: 'INVALID_AUTH_FORMAT',
                message: 'Invalid authorization format'
            });
        }

        const { data: authData, error: authError } =
            await supabase.auth.getUser(token);

        if (authError || !authData.user) {
            return res.status(401).json({
                success: false,
                code: 'INVALID_OR_EXPIRED_TOKEN',
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
                code: 'USER_PROFILE_NOT_FOUND',
                message: 'CloudBox user profile was not found'
            });
        }

        // Both lookups depend on the profile, but not on each other.
        const [roleResult, statusResult] = await Promise.all([
            authenticatedSupabase.from('rol').select('id, nombre')
                .eq('id', userProfile.id_rol).single(),
            authenticatedSupabase.from('estado_usuario').select('id, nombre')
                .eq('id', userProfile.id_estado).single()
        ]);
        const { data: role, error: roleError } = roleResult;
        const { data: userStatus, error: statusError } = statusResult;

        if (roleError || !role) {
            return res.status(403).json({
                success: false,
                code: 'USER_ROLE_NOT_FOUND',
                message: 'User role was not found'
            });
        }

        if (statusError || !userStatus) {
            return res.status(403).json({
                success: false,
                code: 'USER_STATUS_NOT_FOUND',
                message: 'User status was not found'
            });
        }

        if (userStatus.nombre.toLowerCase() !== 'activo') {
            return res.status(403).json({
                success: false,
                code: 'USER_INACTIVE',
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

        req.supabase = authenticatedSupabase;

        next();
        
    } catch (error) {
        return res.status(500).json({
            success: false,
            code: 'AUTH_VALIDATION_FAILED',
            message: 'Authentication validation failed'
        });
    }
};

module.exports = requireAuth;