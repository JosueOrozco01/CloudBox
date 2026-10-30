'use strict';

// SQL DATE is a civil UTC day. fecha_fin remains valid through that whole day.
const utcDay = (date = new Date()) => new Date(date).toISOString().slice(0, 10);
const isCurrent = (row, today = utcDay()) => Boolean(row.fecha_inicio &&
  String(row.fecha_inicio).slice(0,10) <= today &&
  (!row.fecha_fin || String(row.fecha_fin).slice(0,10) >= today));
const isFree = plan => String(plan?.nombre).trim().toLowerCase() === 'free' &&
  Number(plan.precio) === 0 && Number(plan.espacio_maximo_gb) === 1;

// Rebuild every page; advance by returned rows to respect a lower server max_rows.
async function readPages(build) {
  const rows = [];
  for (;;) {
    const {data,error} = await build().range(rows.length, rows.length + 999);
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('Respuesta de consulta incompleta');
    if (!data.length) return rows;
    rows.push(...data);
  }
}
async function freePlan(db) {
  const plans = await readPages(() => db.from('plan').select('*')
    .eq('precio',0).eq('espacio_maximo_gb',1).eq('id_estado',1).order('id'));
  const plan = plans.find(isFree);
  if (!plan) {
    const error = new Error('Plan Free Q0/1 GB activo no disponible');
    error.status = 503; error.code = 'FREE_PLAN_UNAVAILABLE'; throw error;
  }
  return plan;
}
function calendarDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
module.exports = {utcDay,isCurrent,isFree,readPages,freePlan,calendarDate};
