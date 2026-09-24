const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication is required'
            });
        }

        const currentRole = req.user.role.toLowerCase();

        const normalizedAllowedRoles = allowedRoles.map((role) =>
            role.toLowerCase()
        );

        // Restrict access when the authenticated user does not have an allowed role.
        if (!normalizedAllowedRoles.includes(currentRole)) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to access this resource'
            });
        }

        next();
    };
};

module.exports = requireRole;