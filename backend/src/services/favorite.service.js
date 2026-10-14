const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ACTIVE_FILE_STATUS = 1;

function createServiceError(message, status, code) {
    const error = new Error(message);
    error.status = status;
    error.code = code;

    return error;
}

const FavoriteService = {
    async validateOwnedFile(userId, fileId) {
        const { data, error } = await supabaseAdmin
            .from('archivo')
            .select(`
                id,
                nombre,
                id_usuario,
                id_estado
            `)
            .eq('id', fileId)
            .eq('id_usuario', userId)
            .eq('id_estado', ACTIVE_FILE_STATUS)
            .maybeSingle();

        if (error) {
            throw new Error(
                `Error al validar el archivo: ${error.message}`
            );
        }

        return data;
    },

    async addFavorite(userId, fileId) {
        const file = await this.validateOwnedFile(
            userId,
            fileId
        );

        if (!file) {
            throw createServiceError(
                'El archivo no existe o no está disponible',
                404,
                'FILE_NOT_FOUND'
            );
        }

        const { data, error } = await supabaseAdmin
            .from('favorito')
            .insert({
                id_usuario: userId,
                id_archivo: fileId
            })
            .select(`
                id,
                fecha_agregado,
                id_usuario,
                id_archivo
            `)
            .single();

        if (error) {
            if (error.code === '23505') {
                throw createServiceError(
                    'El archivo ya está en favoritos',
                    409,
                    'FAVORITE_ALREADY_EXISTS'
                );
            }

            throw new Error(
                `Error al agregar el favorito: ${error.message}`
            );
        }

        return data;
    },

    async removeFavorite(userId, fileId) {
        const { data, error } = await supabaseAdmin
            .from('favorito')
            .delete()
            .eq('id_usuario', userId)
            .eq('id_archivo', fileId)
            .select(`
                id,
                id_usuario,
                id_archivo
            `)
            .maybeSingle();

        if (error) {
            throw new Error(
                `Error al eliminar el favorito: ${error.message}`
            );
        }

        if (!data) {
            throw createServiceError(
                'El archivo no está en favoritos',
                404,
                'FAVORITE_NOT_FOUND'
            );
        }

        return data;
    },

    async getFavorites(userId) {
        const { data, error } = await supabaseAdmin
            .from('favorito')
            .select(`
                id,
                fecha_agregado,
                id_archivo,
                archivo (
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
                )
            `)
            .eq('id_usuario', userId)
            .order(
                'fecha_agregado',
                { ascending: false }
            );

        if (error) {
            throw new Error(
                `Error al obtener favoritos: ${error.message}`
            );
        }

        return data.filter(
            (favorite) =>
                favorite.archivo &&
                favorite.archivo.id_estado === ACTIVE_FILE_STATUS
        );
    },

    async isFavorite(userId, fileId) {
        const { data, error } = await supabaseAdmin
            .from('favorito')
            .select('id')
            .eq('id_usuario', userId)
            .eq('id_archivo', fileId)
            .maybeSingle();

        if (error) {
            throw new Error(
                `Error al verificar favorito: ${error.message}`
            );
        }

        return Boolean(data);
    }
};

module.exports = FavoriteService;