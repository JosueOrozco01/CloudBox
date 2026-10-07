const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

const AdminService = {
  async getAllUsers() {
    const { data, error } = await supabaseAdmin
      .from('usuario')
      .select(
        'id, nombre, apellido, correo, fecha_registro, id_rol, rol:id_rol(nombre), id_estado, estado_usuario:id_estado(nombre)'
      )
      .order('id', { ascending: true });

    if (error) {
      throw new Error(`Error al obtener usuarios: ${error.message}`);
    }

    return data;
  },

  async updateUserStatus(targetUserId, newStatusId) {
    const { data, error } = await supabaseAdmin
      .from('usuario')
      .update({ id_estado: newStatusId })
      .eq('id', targetUserId)
      .select('id, nombre, id_estado')
      .single();

    if (error) {
      throw new Error(`Error al actualizar estado del usuario: ${error.message}`);
    }

    return data;
  },

  async updateUserRole(targetUserId, newRoleId) {
    const { data, error } = await supabaseAdmin
      .from('usuario')
      .update({ id_rol: newRoleId })
      .eq('id', targetUserId)
      .select('id, nombre, id_rol')
      .single();

    if (error) {
      throw new Error(`Error al actualizar rol del usuario: ${error.message}`);
    }

    return data;
  },

  async getAuditLogs(limit = 20, offset = 0) {
    const { data, error, count } = await supabaseAdmin
      .from('LogAuditoria')
      .select('*', { count: 'exact' })
      .order('fecha', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Error al obtener bitácora: ${error.message}`);
    }

    return {
      logs: data,
      total: count
    };
  }
};

module.exports = AdminService;