const authorizeRole = (allowedRoles = []) => {
    return (req, res, next) => {
        // req.user.role fue resuelto en auth.middleware.js desde la tabla rol
        const userRole = req.user && req.user.role;

        if (!userRole) {
            return res.status(403).json({ 
                success: false, 
                status: 403,
                code: "FORBIDDEN",
                message: "Acceso denegado: permisos insuficientes" 
            });
        }
        
        if (allowedRoles.includes(userRole)) {
            return next();
        }

        return res.status(403).json({ 
            success: false, 
            status: 403,
            code: "FORBIDDEN",
            message: "Acceso denegado: permisos insuficientes" 
        });
    };
};

module.exports = authorizeRole;