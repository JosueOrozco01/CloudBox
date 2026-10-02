const supabase = require('../config/supabase');

const FolderService = {
  /**
   * Crea una nueva carpeta
   * @param {Object} params
   * @param {string} params.nombre - Nombre de la carpeta
   * @param {number} params.id_usuario - ID del usuario creador
   * @param {number|null} [params.id_padre=null] - ID de la carpeta padre (null para raíz)
   * @returns {Promise<Object>} Carpeta creada
   */
  async createFolder({ nombre, id_usuario, id_padre = null }) {
    const nombreLimpio = nombre ? nombre.trim() : '';
    
    // 1. Validar nombre no vacío
    if (!nombreLimpio) {
      throw new Error('El nombre de la carpeta no puede estar vacío.');
    }

    // 2. Construir query para validar duplicados
    let query = supabase
      .from('carpeta')
      .select('id')
      .eq('id_usuario', id_usuario)
      .eq('nombre', nombreLimpio);

    // Supabase maneja null diferente en las consultas, se debe usar .is()
    if (id_padre === null) {
      query = query.is('id_padre', null);
    } else {
      query = query.eq('id_padre', id_padre);
    }

    const { data: existingFolders, error: checkError } = await query;

    if (checkError) {
      throw new Error(`Error al verificar duplicados: ${checkError.message}`);
    }

    if (existingFolders && existingFolders.length > 0) {
      throw new Error('Ya existe una carpeta con ese nombre en esta ubicación.');
    }

    // 3. Insertar la carpeta
    const { data, error } = await supabase
      .from('carpeta')
      .insert([
        {
          nombre: nombreLimpio,
          id_usuario,
          id_padre
        }
      ])
      .select()
      .single();

    if (error) {
      throw new Error(`Error al crear la carpeta: ${error.message}`);
    }

    return data;
  },

  /**
   * Obtiene una carpeta por su ID y valida pertenencia al usuario
   * @param {number} folderId - ID numérico de la carpeta
   * @param {number} userId - ID numérico del usuario
   * @returns {Promise<Object|null>} Carpeta encontrada o null
   */
  async getFolderById(folderId, userId) {
    const { data, error } = await supabase
      .from('carpeta')
      .select('*')
      .eq('id', folderId)
      .eq('id_usuario', userId)
      .single();

    if (error) {
      // Supabase lanza el código PGRST116 cuando .single() no devuelve resultados
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Error al obtener la carpeta: ${error.message}`);
    }

    return data;
  },

  /**
   * Valida si una carpeta existe y pertenece al usuario (Contrato 2)
   * @param {number} folderId - ID numérico de la carpeta destino
   * @param {number} userId - ID numérico del usuario autenticado
   * @returns {Promise<boolean>}
   */
  async validateFolderOwnership(folderId, userId) {
    // Si folderId es nulo o indefinido, asumimos que va a la raíz, que siempre pertenece al usuario
    if (!folderId) return true;

    const folder = await this.getFolderById(folderId, userId);
    return !!folder;
  }
};

module.exports = FolderService;
