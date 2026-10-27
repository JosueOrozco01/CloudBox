'use strict';
const { createClient } = require('@supabase/supabase-js');

let admin;
function database() {
  if (!admin) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw makeError(503, 'SUBSCRIPTIONS_NOT_CONFIGURED', 'Falta configurar Supabase');
    admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return admin;
}
function makeError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.statusCode = status;
  error.code = code;
  return error;
}
function assertResult(result) {
  if (result.error) throw makeError(500, 'SUBSCRIPTION_QUERY_FAILED', 'No se pudo consultar las suscripciones');
  return result.data;
}
function daysRemaining(date, now = new Date()) {
  if (!date) return null;
  const end = new Date(date);
  if (Number.isNaN(end.getTime())) return null;
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));
}
function normalize(row, plan, status, now = new Date()) {
  return {
    id: row.id,
    planId: row.id_plan,
    planName: plan?.nombre || null,
    capacityGb: plan?.espacio_maximo_gb == null ? null : Number(plan.espacio_maximo_gb),
    price: plan?.precio == null ? null : Number(plan.precio),
    status: status || null,
    startDate: row.fecha_inicio,
    endDate: row.fecha_fin,
    daysRemaining: plan?.precio != null && Number(plan.precio) === 0 ? null : (['Activa', 'PorVencer'].includes(status) ? daysRemaining(row.fecha_fin, now) : 0)
  };
}
async function enrich(rows) {
  if (!rows.length) return [];
  const planIds = [...new Set(rows.map(r => r.id_plan))];
  const stateIds = [...new Set(rows.map(r => r.id_estado))];
  const [planResult, stateResult] = await Promise.all([
    database().from('plan').select('id,nombre,precio,espacio_maximo_gb').in('id', planIds),
    database().from('estado_suscripcion').select('id,nombre').in('id', stateIds)
  ]);
  const plans = new Map(assertResult(planResult).map(p => [p.id, p]));
  const states = new Map(assertResult(stateResult).map(s => [s.id, s.nombre]));
  return rows.map(r => normalize(r, plans.get(r.id_plan), states.get(r.id_estado)));
}
async function getCurrent(userId) {
  const rows = assertResult(await database().from('suscripcion')
    .select('id,id_usuario,id_plan,id_estado,fecha_inicio,fecha_fin')
    .eq('id_usuario', userId).in('id_estado', [2, 3])
    .order('fecha_inicio', { ascending: false }).order('id', { ascending: false }));
  const now = new Date();
  const validRows = rows.filter(row => row.fecha_inicio && row.fecha_fin &&
    new Date(row.fecha_inicio).getTime() <= now.getTime() &&
    new Date(row.fecha_fin).getTime() > now.getTime());
  if (validRows.length > 1) throw makeError(409, 'MULTIPLE_ACTIVE_SUBSCRIPTIONS', 'El usuario tiene varias suscripciones vigentes');
  return (await enrich(validRows))[0] || null;
}
async function getHistory(userId) {
  const rows = assertResult(await database().from('suscripcion')
    .select('id,id_usuario,id_plan,id_estado,fecha_inicio,fecha_fin')
    .eq('id_usuario', userId).order('fecha_inicio', { ascending: false })
    .order('id', { ascending: false }).limit(100));
  return enrich(rows);
}
module.exports = { getCurrent, getHistory, daysRemaining, normalize };
