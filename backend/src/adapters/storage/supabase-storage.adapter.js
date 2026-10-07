const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUCKET_NAME = 'cloudbox-files';

const SupabaseStorageAdapter = {
    async upload({
        storagePath,
        buffer,
        mimeType
    }) {
        const { data, error } = await supabaseAdmin.storage
            .from(BUCKET_NAME)
            .upload(
                storagePath,
                buffer,
                {
                    contentType: mimeType,
                    upsert: false
                }
            );

        if (error) {
            throw new Error(
                `Error al subir el archivo: ${error.message}`
            );
        }

        return {
            path: data.path,
            fullPath: data.fullPath
        };
    },

    async createSignedUrl(storagePath, expiresIn = 60) {
        const { data, error } = await supabaseAdmin.storage
            .from(BUCKET_NAME)
            .createSignedUrl(
                storagePath,
                expiresIn
            );

        if (error) {
            throw new Error(
                `Error al generar URL de descarga: ${error.message}`
            );
        }

        return data.signedUrl;
    },

    async deleteFile(storagePath) {
        const { error } = await supabaseAdmin.storage
            .from(BUCKET_NAME)
            .remove([storagePath]);

        if (error) {
            throw new Error(
                `Error al eliminar el archivo de Storage: ${error.message}`
            );
        }

        return true;
    }
};

module.exports = SupabaseStorageAdapter;
