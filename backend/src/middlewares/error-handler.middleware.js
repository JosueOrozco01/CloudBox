const multer = require('multer');

const errorHandler = (error, req, res, next) => {
    const invariants = {
        CLOUDBOX_FOLDER_DUPLICATE: [409, 'Ya existe una carpeta con ese nombre en esta ubicación.'],
        CLOUDBOX_FOLDER_CYCLE: [409, 'No puedes mover una carpeta dentro de sus subcarpetas.'],
        CLOUDBOX_FOLDER_PARENT_INVALID: [409, 'La carpeta de destino ya no está disponible.'],
        CLOUDBOX_TICKET_CLOSED: [409, 'La solicitud está cerrada.']
    };
    const invariant = Object.keys(invariants).find(code => error.message?.includes(code));
    if (invariant) return res.status(invariants[invariant][0]).json({success:false,code:invariant,message:invariants[invariant][1]});
    if (
        error instanceof multer.MulterError &&
        error.code === 'LIMIT_FILE_SIZE'
    ) {
        return res.status(413).json({
            success: false,
            code: 'FILE_TOO_LARGE',
            message: 'El archivo excede el tamaño máximo permitido de 50 MB'
        });
    }

    const statusCode = error.status || 500;
    const errorCode =
        error.code || 'INTERNAL_SERVER_ERROR';

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
            ? 'No se pudo completar la operación. Inténtalo nuevamente.'
            : error.message ||
            'No se pudo procesar la solicitud.';

    return res.status(statusCode).json({
        success: false,
        code: errorCode,
        message
    });
};

module.exports = errorHandler;
