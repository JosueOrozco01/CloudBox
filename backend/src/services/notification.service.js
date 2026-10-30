const { createClient } = require('@supabase/supabase-js');
const { pagination, resourceId } = require('./history-validation');
const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  {auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}}
);
const TYPES = Object.freeze(['FILE_SHARED', 'FOLDER_SHARED', 'ACCESS_REVOKED', 'PAYMENT_APPROVED', 'SUBSCRIPTION_ACTIVATED', 'SUBSCRIPTION_EXPIRING', 'STORAGE_NEAR_LIMIT']);
const columns = 'id,id_usuario,tipo,titulo,mensaje,tipo_recurso,id_recurso,fecha_creacion,leida,fecha_lectura';
const missing = () => Object.assign(new Error('Notificación no encontrada'), { status: 404 });
function check(error) { if (error) throw new Error('No se pudo procesar la notificación'); }
async function createNotification({ recipientUserId, type, title, message, resourceType = null, resourceId: targetId = null, deduplicationKey = null }) {
  resourceId(recipientUserId);
  if (!TYPES.includes(type) || typeof title !== 'string' || !title.trim() || title.length > 255 || typeof message !== 'string' || !message.trim() || message.length > 2000 || (resourceType !== null && !['archivo', 'carpeta', 'pago', 'suscripcion', 'almacenamiento'].includes(resourceType)) || (targetId !== null && (!Number.isSafeInteger(targetId) || targetId < 1 || targetId > 2147483647)) || (deduplicationKey !== null && (typeof deduplicationKey !== 'string' || !deduplicationKey.trim() || deduplicationKey.length > 200))) throw Object.assign(new Error('Notificación inválida'), { status: 400 });
  const {data,error} = await db.rpc('cloudbox_notification_create_v1', {
    p_user_id:Number(recipientUserId),p_type:type,p_title:title,p_message:message,
    p_resource_type:resourceType,p_resource_id:targetId,p_key:deduplicationKey
  });
  check(error); return data;

}
async function listNotifications(userId, options = {}, unread = false) {
  const { limit, offset } = pagination(options);
  let query = db.from('notificacion').select(columns).eq('id_usuario', userId);
  if (unread) query = query.eq('leida', false);
  const { data, error } = await query.order('fecha_creacion', { ascending: false }).order('id', { ascending: false }).range(offset, offset + limit - 1);
  check(error); return data || [];
}
async function markRead(userId, id) {
  resourceId(id);
  const { error } = await db.from('notificacion').update({ leida:true, fecha_lectura: new Date().toISOString() }).eq('id_usuario', userId).eq('id', id).eq('leida', false);
  check(error);
  const result = await db.from('notificacion').select(columns).eq('id_usuario', userId).eq('id', id).maybeSingle();
  check(result.error); if (!result.data) throw missing(); return {...result.data,read:result.data.leida};
}
async function markAllRead(userId) {
  const { count, error } = await db.from('notificacion')
    .update({ leida:true, fecha_lectura: new Date().toISOString() }, { count: 'exact' })
    .eq('id_usuario', userId).eq('leida', false);
  check(error); return { updatedCount: count };
}
async function deleteNotification(userId, id) {
  resourceId(id);
  const { data, error } = await db.from('notificacion').delete().eq('id_usuario', userId).eq('id', id).select('id');
  check(error); if (!data.length) throw missing();
}
// Invoke only after the business transaction commits. A notification outage must not undo it.
async function notifyAfterCommit(event) {
  try { return await createNotification(event); } catch { console.error('Notification persistence failed'); return null; }
}
module.exports = { notifyAfterCommit, TYPES, createNotification, listNotifications, markRead, markAllRead, deleteNotification };
