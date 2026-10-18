const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ACTIONS = Object.freeze({
    CREATE_FOLDER: 'Crear carpeta',
    UPLOAD_FILE: 'Subir archivo',
    DOWNLOAD_FILE: 'Descargar archivo',
    DELETE_FILE: 'Eliminar archivo',
    SHARE_FILE: 'Compartir archivo',
    SHARE_FOLDER: 'Compartir carpeta',
    DELETE_FOLDER: 'Eliminar carpeta'
});

const ActivityService = {
    ACTIONS,

    async getActionId(actionName) {
        const { data, error } = await supabaseAdmin
            .from('accion')
            .select('id')
            .eq('nombre', actionName)
            .maybeSingle();

        if (error) {
            throw new Error(
                `Error al obtener la acción: ${error.message}`
            );
        }

        if (!data) {
            throw new Error(
                `La acción "${actionName}" no está configurada`
            );
        }

        return data.id;
    },

    async recordActivity({
        userId,
        action,
        description,
        fileId = null,
        folderId = null
    }) {
        try {
            const actionId = await this.getActionId(action);

            const activityData = {
                id_usuario: userId,
                id_accion: actionId,
                descripcion: description,
                id_archivo: fileId,
                id_carpeta: folderId
            };

            const { data, error } = await supabaseAdmin
                .from('actividad')
                .insert(activityData)
                .select(`
                    id,
                    fecha,
                    descripcion,
                    id_usuario,
                    id_archivo,
                    id_carpeta,
                    id_accion
                `)
                .single();

            if (error) {
                throw new Error(
                    `Error al registrar actividad: ${error.message}`
                );
            }

            return data;
        } catch (error) {
            // Activity logging must not break the main operation.
            console.error(
                'Activity log failed:',
                error.message
            );

            return null;
        }
    },

    async getUserActivity(
        userId,
        {
            limit = 20,
            offset = 0
        } = {}
    ) {
        const safeLimit = Math.min(
            Math.max(parseInt(limit, 10) || 20, 1),
            100
        );

        const safeOffset = Math.max(
            parseInt(offset, 10) || 0,
            0
        );

        const { data, error } = await supabaseAdmin
            .from('actividad')
            .select(`
                id,
                fecha,
                descripcion,
                id_usuario,
                id_archivo,
                id_carpeta,
                id_accion,
                accion (
                    id,
                    nombre
                )
            `)
            .eq('id_usuario', userId)
            .order(
                'fecha',
                { ascending: false }
            )
            .range(
                safeOffset,
                safeOffset + safeLimit - 1
            );

        if (error) {
            throw new Error(
                `Error al obtener la actividad: ${error.message}`
            );
        }

        return data || [];
    }
};

module.exports = ActivityService;