const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Registra un evento de auditoría en la tabla LogAuditoria
 * @param {Object} params
 * @param {number|string} params.id_usuario - ID del usuario administrador
 * @param {string} params.accion - Acción realizada (ej. 'CAMBIO_ESTADO_USUARIO')
 * @param {Object|string} params.detalles - Detalles de la acción
 * @param {string} [params.ip_origen] - IP de la solicitud
 * @param {string} [params.entidad_afectada] - Nombre de la entidad afectada
 * @param {number|string} [params.id_entidad_afectada] - ID de la entidad afectada
 */
const recordLog = async ({
  id_usuario,
  accion,
  detalles,
  ip_origen,
  entidad_afectada,
  id_entidad_afectada,
}) => {
  try {
    const detalle = typeof detalles === 'object' ? JSON.stringify(detalles) : detalles;
    const parsedIdUsuario = parseInt(id_usuario, 10);

    const logData = {
      id_usuario: parsedIdUsuario,
      accion,
      detalle,
    };

    if (ip_origen) logData.ip_origen = ip_origen;
    if (entidad_afectada) logData.entidad_afectada = entidad_afectada;
    if (id_entidad_afectada) logData.id_entidad_afectada = id_entidad_afectada;

    const { error } = await supabaseAdmin.from('LogAuditoria').insert([logData]);

    if (error) {
      console.error('Error al insertar en LogAuditoria:', error);
    }
  } catch (err) {
    console.error('Error inesperado en recordLog:', err);
  }
};

module.exports = { recordLog };
