const supabase = require('../config/supabase');

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

        const { data, error } = await supabase.auth.getUser(token);

        if (error || !data.user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }

        req.authUser = data.user;

        next();

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Authentication validation failed'
        });
    }
};

module.exports = requireAuth;