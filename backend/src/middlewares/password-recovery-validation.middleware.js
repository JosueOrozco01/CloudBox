const validatePasswordRecovery = (req, res, next) => {
    const { email } = req.body;

    if (!email || !email.trim()) {
        return res.status(400).json({
            success: false,
            code: 'EMAIL_REQUIRED',
            message: 'Email is required'
        });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(normalizedEmail)) {
        return res.status(400).json({
            success: false,
            code: 'INVALID_EMAIL_FORMAT',
            message: 'Email format is invalid'
        });
    }

    req.body.email = normalizedEmail;

    next();
};

module.exports = validatePasswordRecovery;