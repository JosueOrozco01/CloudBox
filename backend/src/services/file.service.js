const { createClient } = require('@supabase/supabase-js');
const FolderService = require('./folder.service');

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const FILE_SELECT = `
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
`;

const ACTIVE_FILE_STATUS = 1;
const TRASH_FILE_STATUS = 2;
const DELETED_FILE_STATUS = 3;

const FileService = {
    async getUserFiles(userId, folderId = null) {
        let query = supabaseAdmin
            .from('archivo')
            .select(FILE_SELECT)
            .eq('id_usuario', userId)
            .eq('id_estado', ACTIVE_FILE_STATUS);

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

    // Integration contract with the folder module.
    // This method is kept so FolderService can query
    // the files belonging to a specific folder.
    async getFilesByFolder(folderId, userId) {
        return this.getUserFiles(
            userId,
            folderId
        );
    },

    async getFileById(fileId, userId) {
        const { data, error } = await supabaseAdmin
            .from('archivo')
            .select(FILE_SELECT)
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

    async moveFile(fileId, userId, folderId = null) {
        const file = await this.getFileById(
            fileId,
            userId
        );

        if (!file) {
            return null;
        }

        if (file.id_estado !== ACTIVE_FILE_STATUS) {
            const error = new Error(
                'Solo se pueden mover archivos activos'
            );

            error.status = 409;
            error.code = 'FILE_NOT_ACTIVE';

            throw error;
        }

        if (folderId !== null) {
            const isValidFolder =
                await FolderService.validateFolderOwnership(
                    folderId,
                    userId
                );

            if (!isValidFolder) {
                const error = new Error(
                    'La carpeta destino no existe o no pertenece al usuario'
                );

                error.status = 403;
                error.code = 'INVALID_FOLDER';

                throw error;
            }
        }

        const { data, error } = await supabaseAdmin
            .from('archivo')
            .update({
                id_carpeta: folderId,
                fecha_modificacion: new Date().toISOString()
            })
            .eq('id', fileId)
            .eq('id_usuario', userId)
            .select(FILE_SELECT)
            .single();

        if (error) {
            throw new Error(
                `Error al mover el archivo: ${error.message}`
            );
        }

        return data;
    },

    async moveToTrash(fileId, userId) {
        const file = await this.getFileById(
            fileId,
            userId
        );

        if (!file) {
            return null;
        }

        if (file.id_estado !== ACTIVE_FILE_STATUS) {
            const error = new Error(
                'Solo se pueden enviar a papelera archivos activos'
            );

            error.status = 409;
            error.code = 'FILE_NOT_ACTIVE';

            throw error;
        }

        const { data, error } = await supabaseAdmin
            .from('archivo')
            .update({
                id_estado: TRASH_FILE_STATUS,
                fecha_modificacion: new Date().toISOString()
            })
            .eq('id', fileId)
            .eq('id_usuario', userId)
            .select(FILE_SELECT)
            .single();

        if (error) {
            throw new Error(
                `Error al enviar el archivo a papelera: ${error.message}`
            );
        }

        return data;
    },

    async restoreFile(fileId, userId) {
        const file = await this.getFileById(
            fileId,
            userId
        );

        if (!file) {
            return null;
        }

        if (file.id_estado !== TRASH_FILE_STATUS) {
            const error = new Error(
                'El archivo no se encuentra en la papelera'
            );

            error.status = 400;
            error.code = 'FILE_NOT_IN_TRASH';

            throw error;
        }

        const { data, error } = await supabaseAdmin
            .from('archivo')
            .update({
                id_estado: ACTIVE_FILE_STATUS,
                fecha_modificacion: new Date().toISOString()
            })
            .eq('id', fileId)
            .eq('id_usuario', userId)
            .select(FILE_SELECT)
            .single();

        if (error) {
            throw new Error(
                `Error al restaurar el archivo: ${error.message}`
            );
        }

        return data;
    },

    async markAsDeleted(fileId, userId) {
        const file = await this.getFileById(
            fileId,
            userId
        );

        if (!file) {
            return null;
        }

        if (file.id_estado !== TRASH_FILE_STATUS) {
            const error = new Error(
                'El archivo debe estar en la papelera antes de eliminarse permanentemente'
            );

            error.status = 400;
            error.code = 'FILE_NOT_IN_TRASH';

            throw error;
        }

        const { data, error } = await supabaseAdmin
            .from('archivo')
            .update({
                id_estado: DELETED_FILE_STATUS,
                fecha_modificacion: new Date().toISOString()
            })
            .eq('id', fileId)
            .eq('id_usuario', userId)
            .select(FILE_SELECT)
            .single();

        if (error) {
            throw new Error(
                `Error al eliminar el archivo: ${error.message}`
            );
        }

        return data;
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
                id_estado: ACTIVE_FILE_STATUS
            })
            .select(FILE_SELECT)
            .single();

        if (error) {
            throw new Error(
                `Error al registrar el archivo: ${error.message}`
            );
        }

        return data;
    },
    async getTrashFiles(userId) {
        const { data, error } = await supabaseAdmin
            .from('archivo')
            .select(FILE_SELECT)
            .eq('id_usuario', userId)
            .eq('id_estado', TRASH_FILE_STATUS)
            .order('fecha_modificacion', { ascending: false });

        if (error) {
            throw new Error(
                `Error al obtener los archivos de la papelera: ${error.message}`
            );
        }

        return data;
    },
    async fileNameExists(
        userId,
        folderId,
        fileName,
        excludeFileId = null
    ) {
        let query = supabaseAdmin
            .from('archivo')
            .select('id')
            .eq('id_usuario', userId)
            .eq('id_estado', ACTIVE_FILE_STATUS)
            .ilike('nombre', fileName);

        if (folderId === null) {
            query = query.is('id_carpeta', null);
        } else {
            query = query.eq('id_carpeta', folderId);
        }

        if (excludeFileId !== null) {
            query = query.neq('id', excludeFileId);
        }

        const { data, error } = await query;

        if (error) {
            throw new Error(
                `Error al validar el nombre del archivo: ${error.message}`
            );
        }

        return data.length > 0;
    },
    async renameFile(fileId, userId, newName) {
        const file = await this.getFileById(
            fileId,
            userId
        );

        if (!file) {
            return null;
        }

        if (file.id_estado !== ACTIVE_FILE_STATUS) {
            const error = new Error(
                'Solo se pueden renombrar archivos activos'
            );

            error.status = 409;
            error.code = 'FILE_NOT_ACTIVE';

            throw error;
        }

        const duplicateExists =
            await this.fileNameExists(
                userId,
                file.id_carpeta,
                newName,
                fileId
            );

        if (duplicateExists) {
            const error = new Error(
                'Ya existe un archivo con ese nombre en la carpeta'
            );

            error.status = 409;
            error.code = 'DUPLICATE_FILE_NAME';

            throw error;
        }

        const { data, error } = await supabaseAdmin
            .from('archivo')
            .update({
                nombre: newName,
                fecha_modificacion: new Date().toISOString()
            })
            .eq('id', fileId)
            .eq('id_usuario', userId)
            .select(FILE_SELECT)
            .single();

        if (error) {
            throw new Error(
                `Error al renombrar el archivo: ${error.message}`
            );
        }

        return data;
    },

};

module.exports = FileService;