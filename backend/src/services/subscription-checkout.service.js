'use strict';
const { createClient } = require('@supabase/supabase-js');
const rules = require('./payment-rules');

let client;
function db() {
  if (!client) {
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!process.env.SUPABASE_URL || !key) throw rules.fail(503, 'SUBSCRIPTIONS_NOT_CONFIGURED', 'Supabase no configurado');
    client = createClient(process.env.SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}
function validate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw rules.fail(400, 'INVALID_SUBSCRIPTION_PAYLOAD', 'Datos de contratación inválidos');
  const planId = rules.parseId(input.planId, 'planId');
  const paymentMethodId = rules.parseId(input.paymentMethodId, 'paymentMethodId');
  const referenceCode = rules.reference(input.referenceCode);
  const simulateFailure = input.simulateFailure === undefined ? false : input.simulateFailure;
  if (typeof simulateFailure !== 'boolean') throw rules.fail(400, 'INVALID_SIMULATION_FLAG', 'simulateFailure debe ser booleano');
  return { planId, paymentMethodId, referenceCode, simulateFailure };
}
async function subscribePaid(userId, input) {
  const validatedUserId = rules.parseId(userId, 'userId');
  const values = validate(input);
  const { data, error } = await db().rpc('cloudbox_subscribe_paid_v1', {
    p_user_id: validatedUserId,
    p_plan_id: values.planId,
    p_method_id: values.paymentMethodId,
    p_reference: values.referenceCode,
    p_simulate_failure: values.simulateFailure
  });
  if (error) {
    if (error.code === '23505') throw rules.fail(409, 'DUPLICATE_TRANSACTION_REFERENCE', 'La referencia de pago ya existe');
    if (error.code === 'P0001' && /^CLOUDBOX_/.test(error.message || '')) {
      const problems = {
        CLOUDBOX_USER_NOT_FOUND: [404, 'USER_NOT_FOUND', 'Usuario no encontrado'],
        CLOUDBOX_PLAN_UNAVAILABLE: [400, 'PLAN_NOT_AVAILABLE', 'Plan no disponible'],
        CLOUDBOX_FREE_NOT_PAYABLE: [400, 'FREE_PLAN_NO_PAYMENT', 'El plan Free no requiere pago'],
        CLOUDBOX_PAYMENT_METHOD_INVALID: [400, 'INVALID_PAYMENT_METHOD', 'Método de pago no disponible'],
        CLOUDBOX_SUBSCRIPTION_STATE_MISSING: [503, 'SUBSCRIPTION_STATE_MISSING', 'Estados de suscripción incompletos'],
        CLOUDBOX_PAYMENT_STATE_MISSING: [503, 'PAYMENT_STATE_MISSING', 'Estados de pago incompletos'],
        CLOUDBOX_MISSING_PAYMENT_REFERENCE: [400, 'INVALID_PAYMENT_REFERENCE', 'Referencia inválida']
      };
      const definition = problems[error.message];
      if (definition) throw rules.fail(...definition);
    }
    throw rules.fail(503, 'SUBSCRIPTION_CHECKOUT_FAILED', 'No se pudo procesar la contratación; no reintentes con otra referencia hasta verificar el historial');
  }
  if (!data || typeof data !== 'object' || typeof data.success !== 'boolean') {
    throw rules.fail(503, 'SUBSCRIPTION_CHECKOUT_INVALID_RESULT', 'Respuesta de contratación inválida');
  }
  return data;
}
module.exports = { validate, subscribePaid };
