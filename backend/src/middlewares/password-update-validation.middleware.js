const validatePasswordUpdate = (req, res, next) => {
    const { password, confirmPassword } = req.body;

    const validationErrors = [];

    if (!password) {
        validationErrors.push('Password is required');
    } else {
        if (password.length < 8) {
            validationErrors.push(
                'Password must contain at least 8 characters'
            );
        }

        if (!/[A-Z]/.test(password)) {
            validationErrors.push(
                'Password must contain at least one uppercase letter'
            );
        }

        if (!/[a-z]/.test(password)) {
            validationErrors.push(
                'Password must contain at least one lowercase letter'
            );
        }

        if (!/[0-9]/.test(password)) {
            validationErrors.push(
                'Password must contain at least one number'
            );
        }
    }

    if (!confirmPassword) {
        validationErrors.push('Password confirmation is required');
    } else if (password !== confirmPassword) {
        validationErrors.push('Passwords do not match');
    }

    if (validationErrors.length > 0) {
        return res.status(400).json({
            success: false,
            code: 'INVALID_PASSWORD_UPDATE',
            message: 'Password data is invalid',
            errors: validationErrors
        });
    }

    next();
};

module.exports = validatePasswordUpdate;