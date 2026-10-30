/**
 * Fixtures estáticos para desarrollo desacoplado - Fase 7 (80%) CloudBox
 * Archivo: backend/src/fixtures/mock-fase7.js
 */

const BYTES_PER_GB = 1024 * 1024 * 1024;

const mockPlans = [
  {
    id: 1,
    nombre: "Plan Básico Gratuito",
    descripcion: "Almacenamiento personal estándar",
    precio: 0.00,
    espacio_maximo_gb: 5,
    capacidad_bytes: 5 * BYTES_PER_GB,
    vigencia_dias: 365,
    id_estado: 1,
    estado: "Activo"
  },
  {
    id: 2,
    nombre: "Plan Pro",
    descripcion: "Para creadores y desarrolladores",
    precio: 9.99,
    espacio_maximo_gb: 100,
    capacidad_bytes: 100 * BYTES_PER_GB,
    vigencia_dias: 30,
    id_estado: 1,
    estado: "Activo"
  },
  {
    id: 3,
    nombre: "Plan Enterprise",
    descripcion: "Almacenamiento masivo corporativo",
    precio: 29.99,
    espacio_maximo_gb: 1024,
    capacidad_bytes: 1024 * BYTES_PER_GB,
    vigencia_dias: 30,
    id_estado: 1,
    estado: "Activo"
  }
];

const mockSubscriptions = [
  {
    id: 101,
    id_usuario: 1,
    id_plan: 2,
    plan_nombre: "Plan Pro",
    id_estado: 1,
    estado: "Activa",
    fecha_inicio: "2026-10-01T00:00:00.000Z",
    fecha_vencimiento: "2026-10-31T23:59:59.000Z",
    dias_restantes: 12
  },
  {
    id: 102,
    id_usuario: 2,
    id_plan: 1,
    plan_nombre: "Plan Básico Gratuito",
    id_estado: 1,
    estado: "Activa",
    fecha_inicio: "2026-01-01T00:00:00.000Z",
    fecha_vencimiento: "2026-12-31T23:59:59.000Z",
    dias_restantes: 73
  }
];

const mockPaymentResponses = {
  success: {
    success: true,
    paymentId: 120,
    transactionId: "TRX-SIM-998877",
    receiptNumber: "REC-202610-000101",
    amount: 9.99,
    reference: "REF-TEST-SUCCESS",
    paidAt: "2026-10-19T18:00:00.000Z"
  },
  declined: {
    success: false,
    status: 402,
    code: "PAYMENT_DECLINED",
    message: "Fondos insuficientes o método inválido en la pasarela simulada",
    transactionId: "TRX-SIM-DECLINED-001"
  },
  duplicate: {
    success: false,
    status: 409,
    code: "DUPLICATE_TRANSACTION_REFERENCE",
    message: "El código de referencia ya fue procesado anteriormente"
  }
};

module.exports = {
  BYTES_PER_GB,
  mockPlans,
  mockSubscriptions,
  mockPaymentResponses
};
