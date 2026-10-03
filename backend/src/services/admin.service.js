const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

const getAllUsers = async () => {
  const { data, error } = await supabaseAdmin
    .from('usuario')
    .select('id, nombre, apellido, correo, id_rol, id_estado');
  if (error) throw error;
  return data;
};

const updateUserStatus = async (targetUserId, newStatusId) => {
  const { data, error } = await supabaseAdmin
    .from('usuario')
    .update({ id_estado: newStatusId })
    .eq('id', targetUserId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

const updateUserRole = async (targetUserId, newRoleId) => {
  const { data, error } = await supabaseAdmin
    .from('usuario')
    .update({ id_rol: newRoleId })
    .eq('id', targetUserId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

const getAuditLogs = async (limit = 20, offset = 0) => {
  const { data, error, count } = await supabaseAdmin
    .from('LogAuditoria')
    .select('*', { count: 'exact' })
    .order('fecha', { ascending: false })
    .range(offset, offset + limit - 1);
  
  if (error) throw error;
  return { logs: data, total: count };
};

module.exports = {
  getAllUsers,
  updateUserStatus,
  updateUserRole,
  getAuditLogs
};
