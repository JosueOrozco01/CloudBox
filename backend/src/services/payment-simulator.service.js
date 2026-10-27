const { createClient } = require('@supabase/supabase-js');
const rules = require('./payment-rules');

let client;
function db() {
  if (!client) {
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!process.env.SUPABASE_URL || !key) throw rules.fail(500, 'PAYMENTS_NOT_CONFIGURED', 'Supabase no está configurado');
    client = createClient(process.env.SUPABASE_URL, key, { auth: { persistSession: false } });
  }
  return client;
}
function check(result) {
  if (result.error) throw rules.fail(500, 'PAYMENTS_DATABASE_ERROR', 'No se pudo completar la operación de pago');
  return result.data;
}
async function statusId(name) {
  const data = check(await db().from('estado_pago').select('id').eq('nombre', name).maybeSingle());
  if (!data) throw rules.fail(500, 'PAYMENT_STATUS_NOT_CONFIGURED', `Falta el estado de pago ${name}`);
  return data.id;
}
async function methodById(value) {
  const id = rules.parseId(value, 'paymentMethodId');
  const method = check(await db().from('metodo_pago').select('id,nombre,estado').eq('id', id).maybeSingle());
  if (!method || !method.estado) throw rules.fail(400, 'INVALID_PAYMENT_METHOD', 'Método de pago no disponible');
  return method;
}
async function targetSubscription(id, userId) {
  const subscriptionId = rules.parseId(id, 'subscriptionId');
  const subscription = check(await db().from('suscripcion').select('id,id_usuario,id_plan').eq('id', subscriptionId).maybeSingle());
  if (!subscription || subscription.id_usuario !== userId) throw rules.fail(404, 'SUBSCRIPTION_NOT_FOUND', 'Suscripción no encontrada');
  return subscription;
}
async function planById(value) {
  const planId = rules.parseId(value, 'planId');
  const plan = check(await db().from('plan').select('id,precio,nombre,id_estado').eq('id', planId).maybeSingle());
  if (!plan) throw rules.fail(404, 'PLAN_NOT_FOUND', 'Plan no encontrado');
  const state = check(await db().from('estado_plan').select('nombre').eq('id', plan.id_estado).maybeSingle());
  if (!state || state.nombre.toLowerCase() !== 'activo') throw rules.fail(400, 'PLAN_NOT_AVAILABLE', 'Plan no disponible');
  return plan;
}
function normalize(row) {
  return { id: row.id, subscriptionId: row.id_suscripcion, referenceCode: row.referencia,
    transactionId: row.transaccion_id, amount: Number(row.monto), paymentMethodId: row.id_metodo_pago,
    paymentStatusId: row.id_estado, paidAt: row.fecha_pago };
}
const Payments = {
  async getMethods() {
    return check(await db().from('metodo_pago').select('id,nombre,descripcion').eq('estado', true).order('id')) || [];
  },
  async getHistory(userId) {
    return (check(await db().from('pago')
      .select('id,id_usuario,id_suscripcion,referencia,transaccion_id,monto,id_metodo_pago,id_estado,fecha_pago')
      .eq('id_usuario', userId).order('id', { ascending: false }).limit(100)) || []).map(normalize);
  },
  async getById({ paymentId, userId, userRole }) {
    const id = rules.parseId(paymentId, 'paymentId');
    const row = check(await db().from('pago')
      .select('id,id_usuario,id_suscripcion,referencia,transaccion_id,monto,id_metodo_pago,id_estado,fecha_pago')
      .eq('id', id).maybeSingle());
    if (!row) throw rules.fail(404, 'PAYMENT_NOT_FOUND', 'Pago no encontrado');
    if (row.id_usuario !== userId && String(userRole).toLowerCase() !== 'administrador') {
      throw rules.fail(403, 'PAYMENT_ACCESS_DENIED', 'No tienes permiso para consultar este pago');
    }
    return normalize(row);
  },
  async processSimulatedPayment({ userId, subscriptionId, planId, paymentMethodId, referenceCode, simulateFailure = false }) {
    const reference = rules.reference(referenceCode);
    if (typeof simulateFailure !== 'boolean') throw rules.fail(400, 'INVALID_SIMULATION_FLAG', 'simulateFailure debe ser booleano');
    const method = await methodById(paymentMethodId);
    const subscription = subscriptionId == null ? null : await targetSubscription(subscriptionId, userId);
    if (!subscription && !simulateFailure) {
      throw rules.fail(400, 'SUBSCRIPTION_REQUIRED', 'El pago aprobado requiere una suscripción existente del usuario');
    }
    const derivedPlanId = subscription ? subscription.id_plan : rules.parseId(planId, 'planId');
    if (planId != null && subscription && rules.parseId(planId, 'planId') !== derivedPlanId) {
      throw rules.fail(400, 'PLAN_MISMATCH', 'El plan no coincide con la suscripción');
    }
    const plan = await planById(derivedPlanId);
    const amountCents = rules.amountToCents(plan.precio);
    const status = await statusId(simulateFailure ? 'Rechazado' : 'Aprobado');
    // The database UNIQUE constraint is the final concurrent-idempotency guard.
    const result = await db().from('pago').insert({
      id_usuario: userId, id_suscripcion: subscription?.id || null,
      id_metodo_pago: method.id, monto: (amountCents / 100).toFixed(2),
      referencia: reference, transaccion_id: rules.transactionId(), id_estado: status
    }).select('id,id_usuario,id_suscripcion,referencia,transaccion_id,monto,id_metodo_pago,id_estado,fecha_pago').single();
    if (result.error?.code === '23505') throw rules.fail(409, 'DUPLICATE_TRANSACTION_REFERENCE', 'La referencia ya fue procesada');
    const saved = check(result);
    return { success: !simulateFailure, ...normalize(saved), status: simulateFailure ? 'Rechazado' : 'Aprobado', planName: plan.nombre };
  }
};
module.exports = Payments;
