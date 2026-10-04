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

    // Integration contract with the folder module
    // This method is kept so FolderService can query
    // the files belonging to a specific folder.
    async getFilesByFolder(folderId, userId) {
        return this.getUserFiles(userId, folderId);
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
    },

    // TEMPORARY VALIDATION — remove once Benja's branch is merged
    // into backend/storage-base.
    //
    // When the coordinator integrates backend/folder-management,
    // replace this with:
    //
    //     FolderService.validateFolderOwnership(folderId, userId)
    //
    // Do not copy or modify Benja's FolderService from this branch.
    async validateFolderOwnership(folderId, userId) {
        if (folderId === null) {
            return true;
        }

        const { data, error } = await supabaseAdmin
            .from('carpeta')
            .select('id')
            .eq('id', folderId)
            .eq('id_usuario', userId)
            .eq('id_estado', 1)
            .maybeSingle();

        if (error) {
            throw new Error(
                `Error al validar la carpeta: ${error.message}`
            );
        }

        return !!data;
    },

    async createFileRecord({
        name,
        size,
        storagePath,
        userId,
        folderId = null,
        extensionId
    }) {
        const { data, error } = await supabaseAdmin
            .from('archivo')
            .insert({
                nombre: name,
                tamano_bytes: size,
                ruta_storage: storagePath,
                id_usuario: userId,
                id_carpeta: folderId,
                id_extension: extensionId,
                id_estado: 1
            })
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
            .single();

        if (error) {
            throw new Error(
                `Error al registrar el archivo: ${error.message}`
            );
        }

        return data;
    }
};

module.exports = FileService;