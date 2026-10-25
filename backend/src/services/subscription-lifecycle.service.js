'use strict';
const { createClient } = require('@supabase/supabase-js');
const rules = require('./payment-rules');
let client;
function db() {
  if (!client) {
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!process.env.SUPABASE_URL || !key) throw rules.fail(503, 'SUBSCRIPTIONS_NOT_CONFIGURED', 'Configuración de Supabase incompleta');
    client = createClient(process.env.SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}
function validatePayment(input, mode) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw rules.fail(400, 'INVALID_SUBSCRIPTION_PAYLOAD', 'Solicitud inválida');
  const planId = mode === 'change' ? rules.parseId(input.newPlanId, 'newPlanId') : undefined;
  const paymentMethodId = rules.parseId(input.paymentMethodId, 'paymentMethodId');
  const referenceCode = rules.reference(input.referenceCode);
  const simulateFailure = input.simulateFailure === undefined ? false : input.simulateFailure;
  if (typeof simulateFailure !== 'boolean') throw rules.fail(400, 'INVALID_SIMULATION_FLAG', 'simulateFailure debe ser booleano');
  return { planId, paymentMethodId, referenceCode, simulateFailure };
}
function toDomainError(error) {
  if (error.code === '23505') return rules.fail(409, 'DUPLICATE_TRANSACTION_REFERENCE', 'Referencia de pago duplicada');
  const problems = {
    CLOUDBOX_USER_NOT_FOUND: [404, 'USER_NOT_FOUND', 'Usuario no encontrado'],
    CLOUDBOX_NO_ACTIVE_SUBSCRIPTION: [409, 'NO_ACTIVE_SUBSCRIPTION', 'No existe una suscripción vigente'],
    CLOUDBOX_FREE_RENEWAL_NOT_REQUIRED: [400, 'FREE_RENEWAL_NOT_REQUIRED', 'Free no requiere renovación'],
    CLOUDBOX_SAME_PLAN_REQUIRES_RENEWAL: [409, 'SAME_PLAN_REQUIRES_RENEWAL', 'Para el mismo plan utiliza renovación'],
    CLOUDBOX_SAME_PLAN_REQUIRED: [409, 'SAME_PLAN_REQUIRED', 'Usa cambio de plan para seleccionar otro plan'],
    CLOUDBOX_PLAN_UNAVAILABLE: [400, 'PLAN_NOT_AVAILABLE', 'Plan no disponible'],
    CLOUDBOX_PAYMENT_METHOD_INVALID: [400, 'INVALID_PAYMENT_METHOD', 'Método de pago no disponible'],
    CLOUDBOX_FREE_NOT_PAYABLE: [400, 'FREE_PLAN_NO_PAYMENT', 'No se cobran planes gratuitos'],
    CLOUDBOX_INVALID_REFERENCE: [400, 'INVALID_PAYMENT_REFERENCE', 'Referencia inválida'],
    CLOUDBOX_STATE_NOT_FOUND: [503, 'SUBSCRIPTION_STATE_MISSING', 'Estados incompletos'],
    CLOUDBOX_ACTIVE_EXISTS: [409, 'ACTIVE_SUBSCRIPTION_EXISTS', 'Existe una suscripción vigente'],
    CLOUDBOX_INVALID_PLAN_DOWNGRADE: [400, 'FREE_ONLY_ON_CANCEL', 'Utiliza cancelación para regresar a Free']
  };
  const problem = Object.entries(problems).find(([key]) => (error.message || '').includes(key));
  if (problem) return rules.fail(...problem[1]);
  return rules.fail(503, 'SUBSCRIPTION_LIFECYCLE_FAILED', 'No se pudo completar la operación; consulta el historial antes de reintentar');
}
async function invoke(functionName, params) {
  const { data, error } = await db().rpc(functionName, params);
  if (error) throw toDomainError(error);
  if (!data || typeof data !== 'object' || typeof data.success !== 'boolean') throw rules.fail(503, 'SUBSCRIPTION_LIFECYCLE_INVALID_RESULT', 'Respuesta de operación inválida');
  return data;
}
async function changePlan(userId, body) {
  const p = validatePayment(body, 'change');
  return invoke('cloudbox_subscription_change_v1', {
    p_user_id: rules.parseId(userId, 'userId'), p_plan_id: p.planId, p_method_id: p.paymentMethodId,
    p_reference: p.referenceCode, p_simulate_failure: p.simulateFailure
  });
}
async function renew(userId, body) {
  const p = validatePayment(body, 'renew');
  return invoke('cloudbox_subscription_renew_v1', {
    p_user_id: rules.parseId(userId, 'userId'), p_method_id: p.paymentMethodId,
    p_reference: p.referenceCode, p_simulate_failure: p.simulateFailure
  });
}
async function cancel(userId) {
  return invoke('cloudbox_subscription_cancel_v1', { p_user_id: rules.parseId(userId, 'userId') });
}
async function refreshExpired() {
  return invoke('cloudbox_subscription_expire_v1', {});
}
module.exports = { validatePayment, toDomainError, changePlan, renew, cancel, refreshExpired };
