const validateRegistration = (req, res, next) => {
    const { firstName, lastName, email, password } = req.body;

    const validationErrors = [];

    if (!firstName || !firstName.trim()) {
        validationErrors.push('First name is required');
    }

    if (!lastName || !lastName.trim()) {
        validationErrors.push('Last name is required');
    }

    if (!email || !email.trim()) {
        validationErrors.push('Email is required');
    } else {
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailPattern.test(email.trim())) {
            validationErrors.push('Email format is invalid');
        }
    }

    if (!password) {
        validationErrors.push('Password is required');
    } else {
        if (password.length < 8) {
            validationErrors.push(
                'La contraseña debe contener al menos 8 caracteres'
            );
        }

        if (!/[A-Z]/.test(password)) {
            validationErrors.push(
                'La contraseña debe contener al menos una letra mayúscula'
            );
        }

        if (!/[a-z]/.test(password)) {
            validationErrors.push(
                'La contraseña debe contener al menos una letra minúscula.'
            );
        }

        if (!/[0-9]/.test(password)) {
            validationErrors.push(
                'La contraseña debe contener al menos un número'
            );
        }
    }

    if (validationErrors.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Los datos de registro no son válidos',
            errors: validationErrors
        });
    }

    // Normalize input before sending registration data to the authentication.
    req.body.firstName = firstName.trim();
    req.body.lastName = lastName.trim();
    req.body.email = email.trim().toLowerCase();

    next();
};

module.exports = validateRegistration;