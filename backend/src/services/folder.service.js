const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

const FolderService = {
  async getTrashFolders(userId) {
    const { data, error } = await supabaseAdmin.from('carpeta').select('*')
      .eq('id_usuario', userId).eq('id_estado', 2).order('fecha_modificacion', { ascending: false });
    if (error) throw error;
    return data;
  },
  async createFolder({ nombre, id_usuario, id_padre = null }) {
    const nombreLimpio = nombre ? nombre.trim() : '';

    if (!nombreLimpio) throw new Error('El nombre de la carpeta no puede estar vacío.');

    if (id_padre !== null) {
      const isValid = await this.validateFolderOwnership(id_padre, id_usuario);
      if (!isValid) throw new Error('La carpeta destino no existe o no tienes permisos.');
    }

    let query = supabaseAdmin
      .from('carpeta')
      .select('id')
      .eq('id_usuario', id_usuario)
      .eq('nombre', nombreLimpio)
      .eq('id_estado', 1);

    if (id_padre === null) {
      query = query.is('id_padre', null);
    } else {
      query = query.eq('id_padre', id_padre);
    }

    const { data: existingFolders, error: checkError } = await query;
    if (checkError) throw new Error(`Error al verificar duplicados: ${checkError.message}`);

    if (existingFolders && existingFolders.length > 0) {
      throw new Error('Ya existe una carpeta con ese nombre en esta ubicación.');
    }

    const { data, error } = await supabaseAdmin
      .from('carpeta')
      .insert([{ nombre: nombreLimpio, id_usuario, id_padre, fecha_creacion: new Date().toISOString(), fecha_modificacion: new Date().toISOString() }])
      .select()
      .single();

    if (error) throw new Error(`Error al crear la carpeta: ${error.message}`);
    return data;
  },

  async getFolderById(folderId, userId) {
    const fId = parseInt(folderId, 10);
    const uId = parseInt(userId, 10);

    const { data, error } = await supabaseAdmin
      .from('carpeta')
      .select('*')
      .eq('id', fId)
      .eq('id_usuario', uId)
      .eq('id_estado', 1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Error supabase en getFolderById:', error);
      throw new Error(`Error al obtener la carpeta: ${error.message}`);
    }
    return data;
  },

  async validateFolderOwnership(folderId, userId) {
    if (!folderId) return true;
    const folder = await this.getFolderById(folderId, userId);
    return !!folder;
  },

  async getUserRootFolders(userId) {
    const { data, error } = await supabaseAdmin
      .from('carpeta')
      .select('*')
      .eq('id_usuario', userId)
      .is('id_padre', null)
      .eq('id_estado', 1)
      .order('nombre', { ascending: true });

    if (error) throw new Error(`Error al obtener carpetas raíz: ${error.message}`);
    return data;
  },

  async getSubfolders(parentId, userId) {
    const { data, error } = await supabaseAdmin
      .from('carpeta')
      .select('*')
      .eq('id_usuario', userId)
      .eq('id_padre', parentId)
      .eq('id_estado', 1)
      .order('nombre', { ascending: true });

    if (error) throw new Error(`Error al obtener subcarpetas: ${error.message}`);
    return data;
  },

  async updateFolderName(folderId, userId, newName) {
    const nombreLimpio = newName ? newName.trim() : '';
    if (!nombreLimpio) throw new Error('El nuevo nombre no puede estar vacío.');

    const currentFolder = await this.getFolderById(folderId, userId);
    if (!currentFolder) throw new Error('Carpeta no encontrada o sin permisos.');

    let query = supabaseAdmin
      .from('carpeta')
      .select('id')
      .eq('id_usuario', userId)
      .eq('nombre', nombreLimpio)
      .eq('id_estado', 1);

    if (currentFolder.id_padre === null) {
      query = query.is('id_padre', null);
    } else {
      query = query.eq('id_padre', currentFolder.id_padre);
    }

    const { data: existingFolders, error: checkError } = await query;
    if (checkError) throw new Error(`Error al verificar duplicados: ${checkError.message}`);

    if (existingFolders && existingFolders.length > 0 && existingFolders[0].id !== folderId) {
      throw new Error('Ya existe una carpeta con ese nombre en esta ubicación.');
    }

    const { data, error } = await supabaseAdmin
      .from('carpeta')
      .update({ nombre: nombreLimpio, fecha_modificacion: new Date().toISOString() })
      .eq('id', folderId)
      .eq('id_usuario', userId)
      .select()
      .single();

    if (error) throw new Error(`Error al actualizar la carpeta: ${error.message}`);
    return data;
  },

  async _isDescendant(folderId, potentialParentId, userId) {
    let currentId = potentialParentId;
    while (currentId !== null) {
      if (currentId === folderId) {
        return true;
      }
      const parent = await this.getFolderById(currentId, userId);
      if (!parent) break;
      currentId = parent.id_padre;
    }
    return false;
  },

  async moveFolder(folderId, newParentId, userId) {
    if (folderId === newParentId) {
      throw new Error('La carpeta no puede moverse a sí misma.');
    }

    const currentFolder = await this.getFolderById(folderId, userId);
    if (!currentFolder) throw new Error('Carpeta no encontrada o sin permisos.');

    if (newParentId !== null) {
      const isValid = await this.validateFolderOwnership(newParentId, userId);
      if (!isValid) throw new Error('La carpeta destino no existe o no tienes permisos.');

      const isDescendant = await this._isDescendant(folderId, newParentId, userId);
      if (isDescendant) {
        throw new Error('No puedes mover una carpeta dentro de sus subcarpetas.');
      }
    }

    let query = supabaseAdmin
      .from('carpeta')
      .select('id')
      .eq('id_usuario', userId)
      .eq('nombre', currentFolder.nombre)
      .eq('id_estado', 1);

    if (newParentId === null) {
      query = query.is('id_padre', null);
    } else {
      query = query.eq('id_padre', newParentId);
    }

    const { data: existingFolders, error: checkError } = await query;
    if (checkError) throw new Error(`Error al verificar duplicados: ${checkError.message}`);

    if (existingFolders && existingFolders.length > 0 && existingFolders[0].id !== folderId) {
      throw new Error('Ya existe una carpeta con ese nombre en la nueva ubicación.');
    }

    const { data, error } = await supabaseAdmin
      .from('carpeta')
      .update({ id_padre: newParentId, fecha_modificacion: new Date().toISOString() })
      .eq('id', folderId)
      .eq('id_usuario', userId)
      .select()
      .single();

    if (error) throw new Error(`Error al mover la carpeta: ${error.message}`);
    return data;
  },

  async _getFolderTreeIds(folderId, userId) {
    const ids = [];
    const queue = [folderId];
    let index = 0;
    while (index < queue.length) {
      const current = queue[index];
      ids.push(current);

      const sub = await this.getSubfolders(current, userId);
      for (const s of sub) {
        queue.push(s.id);
      }
      index++;
    }
    return ids.reverse(); // Bottom-up para respetar FKs
  },

  async deleteFolderCascade(folderId, userId) {
    const { data, error } = await supabaseAdmin.rpc('eliminar_carpeta_cascada', {
      p_carpeta_id: folderId,
      p_usuario_id: userId
    });

    if (error) {
      throw new Error(`Error al enviar la carpeta a papelera: ${error.message}`);
    }

    return data;
  },

  async restoreFolderCascade(folderId, userId) {
    const { data, error } = await supabaseAdmin.rpc('restaurar_carpeta_cascada', {
      p_carpeta_id: folderId,
      p_usuario_id: userId
    });

    if (error) {
      throw new Error(`Error al restaurar la carpeta: ${error.message}`);
    }

    return data;
  }

};

module.exports = FolderService;
