'use strict';
const { createClient } = require('@supabase/supabase-js');
const Payments = require('./payment-simulator.service');
const { generatePdfBuffer } = require('./receipt-pdf');
const BUCKET = 'receipts-pdf';
let client;
function db() {
  if (!client) {
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!process.env.SUPABASE_URL || !key) throw httpError(500, 'RECEIPTS_NOT_CONFIGURED', 'Falta configurar Supabase');
    client = createClient(process.env.SUPABASE_URL, key, { auth: { persistSession: false } });
  }
  return client;
}
function httpError(status, code, message) {
  const e = new Error(message);
  e.status = status;
  e.statusCode = status;
  e.code = code;
  return e;
}
function unwrap(result, message) {
  if (result.error) throw httpError(500, 'RECEIPT_STORAGE_ERROR', message);
  return result.data;
}
async function ensurePayment({ paymentId, userId, userRole }) {
  // El servicio existente verifica propiedad del pago y permiso de administrador.
  const payment = await Payments.getById({ paymentId, userId, userRole });
  if (payment.paymentStatusId !== 1) throw httpError(409, 'PAYMENT_NOT_APPROVED', 'El pago no estÃ¡ aprobado');
  return payment;
}
async function findReceipt(paymentId) {
  return unwrap(await db().from('comprobante_pago')
    .select('id,numero_comprobante,fecha_emision,monto,ruta_comprobante,id_pago')
    .eq('id_pago', paymentId).maybeSingle(), 'No se pudo consultar el comprobante');
}
function output(row) {
  return { id: row.id, paymentId: row.id_pago, receiptNumber: row.numero_comprobante,
    issuedAt: row.fecha_emision, amount: Number(row.monto), available: Boolean(row.ruta_comprobante) };
}
async function ensureReceipt(args) {
  const payment = await ensurePayment(args);
  let receipt = await findReceipt(payment.id);
  if (receipt?.ruta_comprobante) return output(receipt);
  if (!receipt) {
    const insert = await db().from('comprobante_pago')
      .insert({ id_pago: payment.id, monto: payment.amount })
      .select('id,numero_comprobante,fecha_emision,monto,ruta_comprobante,id_pago').single();
    if (insert.error?.code === '23505') {
      // Dos solicitudes simultÃ¡neas intentaron reservar el mismo comprobante.
      receipt = await findReceipt(payment.id);
      if (!receipt) throw httpError(503, 'RECEIPT_RETRY', 'Reintenta la emisiÃ³n del comprobante');
    } else {
      receipt = unwrap(insert, 'No se pudo reservar el comprobante');
    }
  }
  if (receipt.ruta_comprobante) return output(receipt);
  const [methodResult, subscriptionResult] = await Promise.all([
    db().from('metodo_pago').select('nombre').eq('id', payment.paymentMethodId).maybeSingle(),
    payment.subscriptionId
      ? db().from('suscripcion').select('id_plan').eq('id', payment.subscriptionId).maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);
  // En peticiones de administrador consultamos al propietario mediante id_usuario del pago.
  const paymentOwnerResult = await db().from('pago').select('id_usuario').eq('id', payment.id).single();
  const ownerId = unwrap(paymentOwnerResult, 'No se pudo identificar al propietario').id_usuario;
  if (!ownerId) throw httpError(409, 'PAYMENT_OWNER_REQUIRED', 'El pago no tiene propietario');
  const owner = unwrap(await db().from('usuario').select('nombre,apellido,correo').eq('id', ownerId).single(), 'No se pudo consultar al usuario');
  const method = unwrap(methodResult, 'No se pudo consultar el mÃ©todo');
  const subscription = unwrap(subscriptionResult, 'No se pudo consultar la suscripciÃ³n');
  let planName = null;
  if (subscription?.id_plan) {
    const plan = unwrap(await db().from('plan').select('nombre').eq('id', subscription.id_plan).maybeSingle(), 'No se pudo consultar el plan');
    planName = plan?.nombre;
  }
  const buffer = await generatePdfBuffer({
    number: receipt.numero_comprobante, date: receipt.fecha_emision,
    reference: payment.referenceCode, transaction: payment.transactionId,
    userName: `${owner.nombre || ''} ${owner.apellido || ''}`.trim(), email: owner.correo,
    planName, methodName: method?.nombre, amount: payment.amount
  });
  const path = `usuarios/${ownerId}/comprobantes/${receipt.numero_comprobante}.pdf`;
  const upload = await db().storage.from(BUCKET).upload(path, buffer, {
    contentType: 'application/pdf', upsert: true, cacheControl: '3600'
  });
  unwrap(upload, 'No se pudo subir el PDF al bucket privado');
  const saved = unwrap(await db().from('comprobante_pago')
    .update({ ruta_comprobante: path }).eq('id', receipt.id)
    .select('id,numero_comprobante,fecha_emision,monto,ruta_comprobante,id_pago').single(), 'No se pudo registrar la ruta del PDF');
  return output(saved);
}
async function getDownload(args) {
  const info = await ensureReceipt(args);
  const receipt = await findReceipt(info.paymentId);
  if (!receipt?.ruta_comprobante) throw httpError(503, 'RECEIPT_NOT_READY', 'Comprobante no disponible');
  const data = unwrap(await db().storage.from(BUCKET).createSignedUrl(receipt.ruta_comprobante, 60), 'No se pudo crear el enlace de descarga');
  return { ...info, url: data.signedUrl, expiresInSeconds: 60 };
}
module.exports = { ensureReceipt, getDownload, generatePdfBuffer };
