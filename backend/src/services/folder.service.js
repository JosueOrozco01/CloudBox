const { readPages } = require('./commercial-policy');
const validation = require('./input-validation');
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

const FolderService = {
  async getLocations(userId) {
    const folders=await readPages(() => supabaseAdmin.from('carpeta').select('id,nombre,id_padre').eq('id_usuario',userId).eq('id_estado',1).order('id'));
    const byId=new Map(folders.map(folder=>[folder.id,folder]));
    return folders.map(folder=>{
      const names=[folder.nombre],seen=new Set([folder.id]);let parent=byId.get(folder.id_padre);
      while(parent) { if(seen.has(parent.id)) throw validation.invalid('La jerarquía de carpetas contiene un ciclo.'); seen.add(parent.id);names.unshift(parent.nombre);parent=byId.get(parent.id_padre); }
      return {id:folder.id,name:names.join(' / ')};
    });
  },
  async getTrashFolders(userId) {
    return readPages(() => supabaseAdmin.from('carpeta').select('*').eq('id_usuario',userId).eq('id_estado',2).order('nombre').order('id'));
  },
  async createFolder({ nombre, id_usuario, id_padre = null }) {
    const nombreLimpio = validation.text(nombre, 'El nombre de la carpeta', 255);
    if (/[\\/\x00-\x1f]/.test(nombreLimpio)) throw validation.invalid('El nombre de la carpeta no es válido.');

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
    return readPages(() => supabaseAdmin.from('carpeta').select('*').eq('id_usuario',userId).is('id_padre',null).eq('id_estado',1).order('nombre').order('id'));
  },
  async getSubfolders(parentId, userId) {
    return readPages(() => supabaseAdmin.from('carpeta').select('*').eq('id_usuario',userId).eq('id_padre',parentId).eq('id_estado',1).order('nombre').order('id'));
  },
  async updateFolderName(folderId, userId, newName) {
    const nombreLimpio = validation.text(newName, 'El nombre de la carpeta', 255);
    if (/[\\/\x00-\x1f]/.test(nombreLimpio)) throw validation.invalid('El nombre de la carpeta no es válido.');
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
      if(visited.has(currentId)) throw validation.invalid("La jerarquía de carpetas contiene un ciclo.");
      visited.add(currentId);
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
      if (!isValid) {
        const error = new Error('La carpeta destino no existe o no tienes permisos.');
        error.status = 403;
        error.code = 'EDITOR_PERMISSION_REQUIRED';
        throw error;
      }

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
  },
  async getActiveFolderById(folderId) {
    const { data, error } = await supabaseAdmin
      .from('carpeta')
      .select('*')
      .eq('id', folderId)
      .eq('id_estado', 1)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Error al obtener la carpeta compartida: ${error.message}`
      );
    }

    return data;
  },

  async getActiveSubfolders(parentId) {
    return readPages(() => supabaseAdmin.from('carpeta').select('*').eq('id_padre',parentId).eq('id_estado',1).order('nombre').order('id'));
  },

};

module.exports = FolderService;
