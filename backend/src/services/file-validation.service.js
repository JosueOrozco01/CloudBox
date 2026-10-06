const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MAX_FILE_SIZE = 50 * 1024 * 1024;

const FileValidationService = {
    async validateFile({
        originalName,
        size
    }) {
        if (
            !originalName ||
            typeof originalName !== 'string'
        ) {
            const error = new Error(
                'El archivo debe tener un nombre válido'
            );

            error.status = 400;
            error.code = 'INVALID_FILE_NAME';

            throw error;
        }

        const cleanName = originalName.trim();

        if (
            cleanName.length === 0 ||
            cleanName.length > 255 ||
            /[\/\\\0]/.test(cleanName)
        ) {
            const error = new Error(
                'El nombre del archivo no es válido'
            );

            error.status = 400;
            error.code = 'INVALID_FILE_NAME';

            throw error;
        }

        if (
            typeof size !== 'number' ||
            size < 0
        ) {
            const error = new Error(
                'El tamaño del archivo no es válido'
            );

            error.status = 400;
            error.code = 'INVALID_FILE_SIZE';

            throw error;
        }

        if (size > MAX_FILE_SIZE) {
            const error = new Error(
                'El archivo supera el límite de 50 MB'
            );

            error.status = 413;
            error.code = 'FILE_TOO_LARGE';

            throw error;
        }

        const extension =
            path.extname(cleanName).toLowerCase();

        if (!extension) {
            const error = new Error(
                'El archivo debe tener una extensión'
            );

            error.status = 415;
            error.code = 'FILE_EXTENSION_REQUIRED';

            throw error;
        }

        const { data, error } = await supabaseAdmin
            .from('extension')
            .select('id, nombre, descripcion')
            .eq('nombre', extension)
            .maybeSingle();

        if (error) {
            throw new Error(
                `Error al validar la extensión: ${error.message}`
            );
        }

        if (!data) {
            const validationError = new Error(
                'Tipo de archivo no permitido'
            );

            validationError.status = 415;
            validationError.code =
                'UNSUPPORTED_FILE_TYPE';

            throw validationError;
        }

        return {
            name: cleanName,
            size,
            extension: data
        };
    }
};

module.exports = FileValidationService;