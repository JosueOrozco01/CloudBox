const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

const FolderService = {
  async createFolder({ nombre, id_usuario, id_padre = null }) {
    const nombreLimpio = nombre ? nombre.trim() : '';
    
    if (!nombreLimpio) throw new Error('El nombre de la carpeta no puede estar vacío.');

    let query = supabaseAdmin
      .from('carpeta')
      .select('id')
      .eq('id_usuario', id_usuario)
      .eq('nombre', nombreLimpio);

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
    const { data, error } = await supabaseAdmin
      .from('carpeta')
      .select('*')
      .eq('id', folderId)
      .eq('id_usuario', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
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
      .eq('nombre', nombreLimpio);

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
  }
};

module.exports = FolderService;
