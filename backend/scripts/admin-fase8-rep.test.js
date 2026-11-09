/**
 * Pruebas unitarias e integración para Módulo REP (Reportes Administrativos) - Fase 8
 * Validación de las 12 actividades:
 * 1. Validación de rango de fechas (from <= to, formato ISO YYYY-MM-DD)
 * 2. Reporte de suscripciones vigentes (Activa y PorVencer dentro de vigencia)
 * 3. Exclusión de Pendiente y conteo limpio de vencidas sin duplicados históricos
 * 4. Desglose de suscripciones por plan y tendencia mensual
 * 5. Reporte de ingresos: solo pagos Aprobados (id_estado = 1) y monto positivo (> 0)
 * 6. Exclusión de pagos rechazados, pendientes o créditos
 * 7. Métricas de ingresos: ingresosTotales, ticketPromedio y desglose mensual
 * 8. Reporte de usuarios: registros por período, distribución por estado y rol
 * 9. Reporte de almacenamiento: consumo global, promedio por usuario, alertas de sobre cuota y próximos (>80%)
 * 10. Reporte ejecutivo Overview: consolidación de KPIs
 * 11. Exportación CSV: cabeceras text/csv y sanitización contra inyección de fórmulas (=, +, -, @)
 * 12. Exportación PDF: generación de buffer en memoria con pdfkit (sin archivos en disco) y endpoints SEC-01
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const BYTES_PER_GB = 1024 * 1024 * 1024;
const today = new Date().toISOString().split('T')[0];
const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
const lastMonth = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

const tables = {
  usuario: [
    { id: 1, nombre: 'Admin', apellido: 'CloudBox', correo: 'admin@cloudbox.com', id_rol: 1, id_estado: 1, espacio_usado_by: 500 * 1024 * 1024, fecha_registro: '2026-01-10' },
    { id: 2, nombre: 'Carlos', apellido: 'Pro', correo: 'carlos@test.com', id_rol: 2, id_estado: 1, espacio_usado_by: 2 * BYTES_PER_GB, fecha_registro: '2026-02-15' },
    { id: 3, nombre: 'Elena', apellido: 'VencePronto', correo: 'elena@test.com', id_rol: 2, id_estado: 1, espacio_usado_by: 3 * BYTES_PER_GB, fecha_registro: '2026-03-20' },
    { id: 4, nombre: 'Marcos', apellido: 'Excedido', correo: 'marcos@test.com', id_rol: 2, id_estado: 2, espacio_usado_by: 6 * BYTES_PER_GB, fecha_registro: '2026-04-05' },
    { id: 5, nombre: '=FormulaHacker', apellido: '+Inyeccion', correo: '@peligro@test.com', id_rol: 2, id_estado: 1, espacio_usado_by: 100 * 1024 * 1024, fecha_registro: '2026-05-12' }
  ],
  estado_usuario: [
    { id: 1, nombre: 'Activo' },
    { id: 2, nombre: 'Suspendido' }
  ],
  rol: [
    { id: 1, nombre: 'Administrador' },
    { id: 2, nombre: 'Cliente' }
  ],
  plan: [
    { id: 1, nombre: 'Plan Básico Gratuito', precio: 0, espacio_maximo_gb: 1, vigencia_dias: null, id_estado: 1 },
    { id: 2, nombre: 'Plan Básico', precio: 5, espacio_maximo_gb: 5, vigencia_dias: 30, id_estado: 1 },
    { id: 3, nombre: 'Plan Pro', precio: 20, espacio_maximo_gb: 50, vigencia_dias: 30, id_estado: 1 }
  ],
  estado_suscripcion: [
    { id: 1, nombre: 'Pendiente' },
    { id: 2, nombre: 'Activa' },
    { id: 3, nombre: 'PorVencer' },
    { id: 4, nombre: 'Vencida' },
    { id: 5, nombre: 'Cancelada' }
  ],
  suscripcion: [
    // Usuario 2: Activa vigente con Plan Pro (20 USD)
    { id: 101, id_usuario: 2, fecha_inicio: lastMonth, fecha_fin: nextMonth, id_plan: 3, id_estado: 2 },
    // Usuario 3: PorVencer vigente con Plan Básico (5 USD)
    { id: 102, id_usuario: 3, fecha_inicio: lastMonth, fecha_fin: tomorrow, id_plan: 2, id_estado: 3 },
    // Usuario 4: Vencida
    { id: 103, id_usuario: 4, fecha_inicio: '2026-01-01', fecha_fin: yesterday, id_plan: 2, id_estado: 4 },
    // Usuario 5: Pendiente (no debe contarse como vigente)
    { id: 104, id_usuario: 5, fecha_inicio: tomorrow, fecha_fin: nextMonth, id_plan: 3, id_estado: 1 },
    // Histórico cancelado
    { id: 105, id_usuario: 1, fecha_inicio: '2025-01-01', fecha_fin: '2025-02-01', id_plan: 2, id_estado: 5 }
  ],
  estado_pago: [
    { id: 1, nombre: 'Aprobado' },
    { id: 2, nombre: 'Rechazado' },
    { id: 3, nombre: 'Pendiente' }
  ],
  pago: [
    // Transacción 1: Aprobada 20 USD
    { id: 201, monto: 20.00, fecha_pago: '2026-02-15T10:00:00Z', id_estado: 1, referencia: 'PAY-PRO-01', id_suscripcion: 101 },
    // Transacción 2: Aprobada 5 USD
    { id: 202, monto: 5.00, fecha_pago: '2026-03-20T11:00:00Z', id_estado: 1, referencia: 'PAY-BAS-02', id_suscripcion: 102 },
    // Transacción 3: Rechazada (debe excluirse de ingresos)
    { id: 203, monto: 50.00, fecha_pago: '2026-03-22T12:00:00Z', id_estado: 2, referencia: 'PAY-REJ-03', id_suscripcion: 101 },
    // Transacción 4: Monto 0 o crédito (debe excluirse de ingresos comerciales)
    { id: 204, monto: 0.00, fecha_pago: '2026-03-25T13:00:00Z', id_estado: 1, referencia: 'PAY-CREDIT-04', id_suscripcion: 102 }
  ],
  estado_archivo: [
    { id: 1, nombre: 'Activo' },
    { id: 2, nombre: 'En papelera' },
    { id: 3, nombre: 'Eliminado' }
  ],
  archivo: [
    { id: 1, nombre: 'contrato.pdf', tamano_bytes: 10 * 1024 * 1024, id_usuario: 2, id_estado: 1 },
    { id: 2, nombre: 'perfil.jpg', tamano_bytes: 5 * 1024 * 1024, id_usuario: 2, id_estado: 1 },
    { id: 3, nombre: 'informe.docx', tamano_bytes: 8 * 1024 * 1024, id_usuario: 3, id_estado: 1 },
    { id: 4, nombre: 'antiguo.pdf', tamano_bytes: 6 * BYTES_PER_GB, id_usuario: 4, id_estado: 2 },
    // Archivo eliminado (id_estado = 3, debe excluirse)
    { id: 5, nombre: 'basura.pdf', tamano_bytes: 100 * 1024 * 1024, id_usuario: 4, id_estado: 3 }
  ],
  carpeta: [
    { id: 1, nombre: 'Documentos', id_usuario: 2, id_estado: 1 },
    { id: 2, nombre: 'Imágenes', id_usuario: 2, id_estado: 1 }
  ]
};

const createMockDb = () => ({
  auth: {
    admin: {
      listUsers: async () => ({ data: { users: [] }, error: null })
    }
  },
  from(tableName) {
    let filterCol = null;
    let filterVal = null;
    let inCol = null;
    let inVals = null;
    let rangeStart = 0;
    let rangeEnd = 999;

    return {
      select() { return this; },
      eq(col, val) { filterCol = col; filterVal = val; return this; },
      in(col, vals) { inCol = col; inVals = vals; return this; },
      order() { return this; },
      limit() { return this; },
      range(start, end) { rangeStart = start; rangeEnd = end; return this; },
      then(resolve, reject) {
        let rows = [...(tables[tableName] || [])];
        if (filterCol && filterVal !== null) {
          rows = rows.filter(r => r[filterCol] === filterVal);
        }
        if (inCol && Array.isArray(inVals)) {
          rows = rows.filter(r => inVals.includes(r[inCol]));
        }
        const count = rows.length;
        const paged = rows.slice(rangeStart, rangeEnd + 1).map(r => {
          if (tableName === 'suscripcion') {
            const plan = tables.plan.find(p => p.id === r.id_plan);
            const estado = tables.estado_suscripcion.find(e => e.id === r.id_estado);
            return { ...r, plan, estado };
          }
          if (tableName === 'archivo') {
            const estado = tables.estado_archivo.find(e => e.id === r.id_estado);
            return { ...r, estado };
          }
          if (tableName === 'pago') {
            const estado = tables.estado_pago.find(e => e.id === r.id_estado);
            return { ...r, estado };
          }
          return r;
        });
        return Promise.resolve({ data: paged, count, error: null }).then(resolve, reject);
      },
      async maybeSingle() {
        const res = await this.then(r => r);
        return { data: res.data && res.data.length > 0 ? res.data[0] : null, error: null };
      },
      async single() {
        const res = await this.then(r => r);
        return { data: res.data && res.data.length > 0 ? res.data[0] : null, error: null };
      }
    };
  }
});

const mockDb = createMockDb();

function loadModuleWithMock(filePath, customRequires = {}) {
  const context = {
    require: (name) => {
      if (name.includes('supabase')) return { createClient: () => mockDb };
      if (customRequires[name]) return customRequires[name];
      return require('node:module').createRequire(path.join(__dirname,'../src/services/admin.service.js'))(name);
    },
    process: { env: {} },
    module: { exports: {} },
    console,
    Date,
    Number,
    Map,
    Set,
    Math,
    Error,
    Buffer,
    parseInt,
    isNaN
  };

  vm.runInNewContext(fs.readFileSync(filePath, 'utf8'), context);
  return context.module.exports;
}

const QuotaService = loadModuleWithMock(path.join(__dirname, '../src/services/quota.service.js'));
const AdminStorageService = loadModuleWithMock(
  path.join(__dirname, '../src/services/admin-storage.service.js'),
  { './quota.service': QuotaService }
);
const ReportService = loadModuleWithMock(
  path.join(__dirname, '../src/services/report.service.js'),
  {
    './quota.service': QuotaService,
    './admin-storage.service': AdminStorageService
  }
);
const ReportController = loadModuleWithMock(
  path.join(__dirname, '../src/controllers/report.controller.js'),
  { '../services/report.service': ReportService }
);

(async () => {
  console.log('--- TEST FASE 8: MÓDULO REP (REPORTES ADMINISTRATIVOS) ---');

  // =========================================================================
  // Actividad 1: Validación estricta de rango de fechas
  // =========================================================================
  {
    await assert.rejects(
      async () => await ReportService.getSubscriptionsReport({ from: '2026-12-31', to: '2026-01-01' }),
      err => {
        assert.equal(err.status, 400);
        assert.equal(err.code, 'INVALID_DATE_RANGE');
        return true;
      },
      'Debe rechazar cuando from > to'
    );

    await assert.rejects(
      async () => await ReportService.getSubscriptionsReport({ from: 'fecha-invalida' }),
      err => {
        assert.equal(err.status, 400);
        assert.equal(err.code, 'INVALID_DATE_FORMAT');
        return true;
      },
      'Debe rechazar formato no ISO YYYY-MM-DD'
    );
    console.log('✓ Actividad 1 superada: Validación estricta de fechas YYYY-MM-DD y from <= to.');
  }

  // =========================================================================
  // Actividad 2 y 3: Suscripciones vigentes vs. vencidas y exclusión de Pendiente
  // =========================================================================
  {
    const rep = await ReportService.getSubscriptionsReport();
    assert.ok(rep.resumen, 'Debe incluir resumen');
    assert.equal(rep.resumen.vigentes, 2, 'Debe haber 2 vigentes (Activa de usuario 2 y PorVencer de usuario 3)');
    assert.equal(rep.resumen.porVencer, 1, '1 suscripción PorVencer');
    assert.equal(rep.resumen.vencidas, 1, '1 suscripción Vencida (usuario 4)');
    assert.equal(rep.resumen.pendientes, 1, '1 suscripción Pendiente (usuario 5)');
    assert.equal(rep.resumen.canceladas, 1, '1 suscripción Cancelada');

    // Verificar que Pendiente NO esté en vigentes
    const subPendiente = rep.suscripciones.find(s => s.id_usuario === 5);
    assert.equal(subPendiente.vigente, false, 'Pendiente jamás debe contarse como vigente');
    console.log('✓ Actividades 2 y 3 superadas: Suscripciones vigentes (Activa/PorVencer), vencidas limpias y exclusión de Pendiente.');
  }

  // =========================================================================
  // Actividad 4: Desglose por plan y tendencia mensual de suscripciones
  // =========================================================================
  {
    const rep = await ReportService.getSubscriptionsReport();
    assert.ok(Array.isArray(rep.distribucionPlanes));
    assert.ok(rep.distribucionPlanes.length >= 2);
    const planPro = rep.distribucionPlanes.find(p => p.plan === 'Plan Pro');
    const planBas = rep.distribucionPlanes.find(p => p.plan === 'Plan Básico');
    assert.equal(planPro.cantidad, 1);
    assert.equal(planBas.cantidad, 1);

    assert.ok(Array.isArray(rep.tendenciaMensual));
    assert.ok(rep.tendenciaMensual.length > 0);
    console.log('✓ Actividad 4 superada: Desglose de suscripciones por plan y tendencia mensual.');
  }

  // =========================================================================
  // Actividades 5, 6 y 7: Reporte de Ingresos (Pagos Aprobados, exclusión de rechazados y créditos)
  // =========================================================================
  {
    const rep = await ReportService.getRevenueReport();
    // Pagos aprobados: Transacción 1 (20 USD) y Transacción 2 (5 USD).
    // Transacción 3 es Rechazada y Transacción 4 tiene monto 0 (crédito) -> ambas excluidas
    assert.equal(rep.resumen.totalTransacciones, 2, 'Solo 2 transacciones comerciales aprobadas con monto > 0');
    assert.equal(rep.resumen.ingresosTotales, 25.00, 'Ingresos totales deben ser 25 USD (20 + 5)');
    assert.equal(rep.resumen.ticketPromedio, 12.50, 'Ticket promedio 12.50 USD');

    // Desglose mensual
    assert.ok(Array.isArray(rep.desgloseMensual));
    assert.equal(rep.desgloseMensual.length, 2, '2 meses con recaudación');

    // Desglose por plan
    assert.ok(Array.isArray(rep.ingresosPorPlan));
    console.log('✓ Actividades 5, 6 y 7 superadas: Reporte financiero con pagos aprobados, ticket promedio y tendencias.');
  }

  // =========================================================================
  // Actividad 8: Reporte de Usuarios (Período, estados, roles, tendencia)
  // =========================================================================
  {
    const rep = await ReportService.getUsersReport();
    assert.equal(rep.resumen.totalHistorico, 5);
    assert.ok(rep.distribucionEstado.some(e => e.estado === 'Activo' && e.cantidad === 4));
    assert.ok(rep.distribucionEstado.some(e => e.estado === 'Suspendido' && e.cantidad === 1));
    assert.ok(rep.distribucionRol.some(r => r.rol === 'Administrador' && r.cantidad === 1));
    assert.ok(rep.distribucionRol.some(r => r.rol === 'Cliente' && r.cantidad === 4));
    assert.ok(Array.isArray(rep.tendenciaMensual));
    console.log('✓ Actividad 8 superada: Reporte de usuarios con distribución por estado, rol y tendencia mensual.');
  }

  // =========================================================================
  // Actividad 9: Reporte de Almacenamiento (Consumo global, promedio, alertas cuota)
  // =========================================================================
  {
    const rep = await ReportService.getStorageReport();
    assert.ok(rep.consumoGlobal.totalBytes > 0);
    assert.ok(rep.consumoGlobal.totalGb > 0);
    assert.ok(rep.promedioPorUsuario.bytes > 0);
    assert.equal(rep.alertasCuota.totalSobreCuota, 1, 'Usuario 4 sobre cuota');
    assert.ok(rep.distribucionTipo.pdf);
    console.log('✓ Actividad 9 superada: Reporte de almacenamiento, promedio por usuario y alertas de sobre cuota.');
  }

  // =========================================================================
  // Actividad 10: Overview Report (Resumen consolidado de KPIs)
  // =========================================================================
  {
    const overview = await ReportService.getOverviewReport();
    assert.ok(overview.kpis);
    assert.equal(overview.kpis.totalUsuarios, 5);
    assert.equal(overview.kpis.suscripcionesVigentes, 2);
    assert.equal(overview.kpis.ingresosTotales, 25.00);
    assert.equal(overview.kpis.usuariosSobreCuota, 1);
    console.log('✓ Actividad 10 superada: Overview Report consolidado con todos los KPIs ejecutivos.');
  }

  // =========================================================================
  // Actividad 11: Exportación CSV y Sanitización de Inyección de Fórmulas
  // =========================================================================
  {
    const exportedUsers = await ReportService.exportReport({ type: 'users', format: 'csv' });
    assert.equal(exportedUsers.contentType, 'text/csv; charset=utf-8');
    assert.ok(exportedUsers.filename.endsWith('.csv'));

    // Verificar sanitización contra inyección de fórmulas CSV
    // El usuario 5 tiene nombre '=FormulaHacker', apellido '+Inyeccion', correo '@peligro@test.com'
    assert.ok(exportedUsers.data.includes("'=FormulaHacker"), 'Debe escapar = con comilla simple inicial');
    assert.ok(exportedUsers.data.includes("'+Inyeccion"), 'Debe escapar + con comilla simple inicial');
    assert.ok(exportedUsers.data.includes("'@peligro@test.com"), 'Debe escapar @ con comilla simple inicial');

    const exportedRevenue = await ReportService.exportReport({ type: 'revenue', format: 'csv' });
    assert.ok(exportedRevenue.data.includes('20'));
    console.log('✓ Actividad 11 superada: Exportación CSV descargable y blindaje estricto anti inyección de fórmulas.');
  }

  // =========================================================================
  // Actividad 12: Exportación PDF en memoria con PDFKit y Endpoints SEC-01
  // =========================================================================
  {
    const exportedPdf = await ReportService.exportReport({ type: 'overview', format: 'pdf' });
    assert.equal(exportedPdf.contentType, 'application/pdf');
    assert.ok(exportedPdf.filename.endsWith('.pdf'));
    assert.ok(Buffer.isBuffer(exportedPdf.buffer), 'Debe retornar un Buffer binario en memoria');
    assert.ok(exportedPdf.buffer.length > 500, 'El PDF debe tener contenido binario válido');
    assert.equal(exportedPdf.buffer.subarray(0, 4).toString(), '%PDF', 'Cabecera mágica de PDF válida');

    // Validación de controlador
    const createMockRes = () => {
      let headers = {};
      return {
        statusCode: 200,
        headers,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(data) { this.body = data; return this; },
        setHeader(name, val) { headers[name] = val; },
        send(data) { this.body = data; return this; },
        end(data) { this.body = data; return this; }
      };
    };

    const resJson = createMockRes();
    await ReportController.getOverview({}, resJson);
    assert.equal(resJson.statusCode, 200);
    assert.equal(resJson.body.success, true);
    assert.ok(resJson.body.data.kpis);

    const resExport = createMockRes();
    await ReportController.exportReport({ query: { type: 'subscriptions', format: 'csv' } }, resExport);
    assert.equal(resExport.headers['Content-Type'], 'text/csv; charset=utf-8');
    assert.ok(resExport.headers['Content-Disposition'].includes('attachment; filename='));

    // Verificación de archivo de rutas y SEC-01
    const routeContent = fs.readFileSync(path.join(__dirname, '../src/routes/report.routes.js'), 'utf8');
    assert.ok(routeContent.includes('authorizeRole(["Administrador"])') || routeContent.includes("authorizeRole(['Administrador'])"));
    assert.ok(routeContent.includes('/overview'));
    assert.ok(routeContent.includes('/subscriptions'));
    assert.ok(routeContent.includes('/revenue'));
    assert.ok(routeContent.includes('/export'));
    console.log('✓ Actividad 12 superada: Exportación PDF en memoria, controlador con cabeceras y rutas protegidas SEC-01.');
  }

  console.log('\n==================================================================');
  console.log('¡TODAS LAS PRUEBAS DEL MÓDULO REP (FASE 8 - 12 ACTIVIDADES) PASARON!');
  console.log('==================================================================\n');
})().catch(err => {
  console.error('Error en pruebas REP:', err);
  process.exitCode = 1;
});
