const errorHandler = (error, req, res, next) => {
    const statusCode = error.status || 500;
    const errorCode = error.code || 'INTERNAL_SERVER_ERROR';

    // Log internal information only on the backend.
    if (statusCode >= 500) {
        console.error('Application error:', {
            message: error.message,
            code: error.code,
            status: error.status,
            cause: error.cause?.message
        });
    }

    const message =
        statusCode >= 500
            ? 'An unexpected error occurred'
            : error.message || 'Request could not be processed';

    return res.status(statusCode).json({
        success: false,
        code: errorCode,
        message
    });
};

module.exports = errorHandler;