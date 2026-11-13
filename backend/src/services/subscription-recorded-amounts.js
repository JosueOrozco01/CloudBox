'use strict';

function assertResult(result) {
  if (result.error) throw new Error('No se pudieron consultar los importes registrados de las suscripciones');
  return result.data || [];
}

function amountToCents(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) throw new Error('Importe registrado inválido');
  return Math.round(amount * 100);
}

async function getRecordedAmounts(database, subscriptions) {
  const ids = [...new Set(subscriptions.map(row => row.id).filter(id => id != null))];
  if (!ids.length) return new Map();

  const [paymentsResult, creditsResult] = await Promise.all([
    database.from('pago').select('id_suscripcion,monto,id_estado').in('id_suscripcion', ids),
    database.from('evento_credito_suscripcion').select('id_suscripcion_nueva,monto_aplicado').in('id_suscripcion_nueva', ids)
  ]);
  const payments = assertResult(paymentsResult);
  const credits = assertResult(creditsResult);
  const paymentStateIds = [...new Set(payments.map(row => row.id_estado).filter(id => id != null))];
  const states = paymentStateIds.length
    ? assertResult(await database.from('estado_pago').select('id,nombre').in('id', paymentStateIds))
    : [];
  const approvedIds = new Set(states.filter(row => String(row.nombre).trim().toLowerCase() === 'aprobado').map(row => row.id));
  const totals = new Map();
  const add = (subscriptionId, amount) => {
    if (subscriptionId == null) return;
    const current = totals.get(subscriptionId) || { cents: 0, hasRecord: false };
    current.cents += amountToCents(amount);
    current.hasRecord = true;
    totals.set(subscriptionId, current);
  };

  for (const payment of payments) {
    if (approvedIds.has(payment.id_estado)) add(payment.id_suscripcion, payment.monto);
  }
  for (const credit of credits) add(credit.id_suscripcion_nueva, credit.monto_aplicado);

  return new Map([...totals].map(([id, total]) => [id, {
    amount: Number((total.cents / 100).toFixed(2)),
    hasRecord: total.hasRecord
  }]));
}

module.exports = { getRecordedAmounts };
