const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const FileService = {
    async getUserFiles(userId, folderId = null) {
        let query = supabaseAdmin
            .from('archivo')
            .select(`
                id,
                nombre,
                tamano_bytes,
                ruta_storage,
                fecha_subida,
                fecha_modificacion,
                id_usuario,
                id_carpeta,
                id_extension,
                id_estado
            `)
            .eq('id_usuario', userId);

        if (folderId === null) {
            query = query.is('id_carpeta', null);
        } else {
            query = query.eq('id_carpeta', folderId);
        }

        const { data, error } = await query.order(
            'fecha_subida',
            { ascending: false }
        );

        if (error) {
            throw new Error(
                `Error al obtener los archivos: ${error.message}`
            );
        }

        return data;
    },

    async getFileById(fileId, userId) {
        const { data, error } = await supabaseAdmin
            .from('archivo')
            .select('*')
            .eq('id', fileId)
            .eq('id_usuario', userId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }

            throw new Error(
                `Error al obtener el archivo: ${error.message}`
            );
        }

        return data;
    }
};

module.exports = FileService;