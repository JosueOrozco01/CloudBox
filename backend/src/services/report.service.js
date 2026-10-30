const { createClient } = require("@supabase/supabase-js");
const AdminStorageService = require("./admin-storage.service");

let PDFDocument;
try {
  PDFDocument = require("pdfkit");
} catch {
  // Fallback si pdfkit se carga en contexto aislado o mock
}

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const BYTES_PER_GB = 1024 * 1024 * 1024;

function createServiceError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function normalizeDateStr(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().split("T")[0];
  const str = String(val).trim();
  if (str.includes("T")) return str.split("T")[0];
  return str.substring(0, 10);
}

function validateDateRange(from, to) {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (from && !dateRegex.test(from)) {
    throw createServiceError("El parámetro 'from' debe tener el formato YYYY-MM-DD", 400, "INVALID_DATE_FORMAT");
  }
  if (to && !dateRegex.test(to)) {
    throw createServiceError("El parámetro 'to' debe tener el formato YYYY-MM-DD", 400, "INVALID_DATE_FORMAT");
  }
  if (from && to && from > to) {
    throw createServiceError("El parámetro 'from' no puede ser posterior a 'to'", 400, "INVALID_DATE_RANGE");
  }
}

async function readAll(table, columns) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select(columns)
      .order("id")
      .range(offset, offset + 999);
    if (error) {
      throw createServiceError(`No se pudo consultar ${table}: ${error.message}`, 500, "DATABASE_ERROR");
    }
    rows.push(...(data || []));
    if (!data || data.length < 1000) return rows;
  }
}

async function readAllSafe(table, columns) {
  try {
    return await readAll(table, columns);
  } catch {
    return [];
  }
}

async function readAllUsersSafe() {
  try {
    const users = await readAll("usuario", "id,nombre,apellido,correo,id_rol,id_estado,espacio_usado_by,fecha_registro");
    return users.map(u => ({
      ...u,
      espacio_usado_bytes: Number(u.espacio_usado_by ?? 0)
    }));
  } catch (err) {
    if (err.message && (err.message.includes("column") || err.message.includes("42703") || err.message.includes("does not exist"))) {
      const users = await readAll("usuario", "id,nombre,apellido,correo,id_rol,id_estado,espacio_usado_bytes,fecha_registro");
      return users.map(u => ({
        ...u,
        espacio_usado_by: Number(u.espacio_usado_bytes ?? 0),
        espacio_usado_bytes: Number(u.espacio_usado_bytes ?? 0)
      }));
    }
    throw err;
  }
}

/**
 * Sanitiza celdas para prevenir inyección de fórmulas CSV.
 * Si comienza con '=', '+', '-', '@', '\t' o '\r', se antepone una comilla simple.
 */
function sanitizeCsvCell(value) {
  if (value === null || value === undefined) return '""';
  let str = String(value);

  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    str = `"${str.replace(/"/g, '""')}"`;
  } else {
    str = `"${str}"`;
  }

  return str;
}

function generateCsv(headers, rows) {
  const headerLine = headers.map(h => sanitizeCsvCell(h)).join(",");
  const rowLines = rows.map(row => row.map(cell => sanitizeCsvCell(cell)).join(","));
  return [headerLine, ...rowLines].join("\r\n");
}

async function generatePdfBuffer(reportTitle, metadata = {}, sections = []) {
  if (!PDFDocument) {
    try {
      PDFDocument = require("pdfkit");
    } catch {
      throw createServiceError("El módulo pdfkit no está disponible para generar PDF", 500, "PDFKIT_UNAVAILABLE");
    }
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: "A4" });
      const chunks = [];

      doc.on("data", chunk => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", err => reject(err));

      // Header Corporativo
      doc.fontSize(18).fillColor("#1e293b").text("CloudBox - Almacenamiento Seguro", { align: "left" });
      doc.fontSize(10).fillColor("#64748b").text("Panel de Administración y Analítica Global", { align: "left" });
      doc.moveDown(0.5);

      doc.strokeColor("#e2e8f0").lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.8);

      // Título del reporte
      doc.fontSize(15).fillColor("#0f172a").text(reportTitle);
      doc.moveDown(0.4);

      // Metadatos
      doc.fontSize(9).fillColor("#475569");
      if (metadata.periodo) {
        doc.text(`Período analizado: ${metadata.periodo}`);
      }
      doc.text(`Generado el: ${new Date().toISOString().replace("T", " ").substring(0, 19)} UTC`);
      doc.moveDown(0.8);

      // Secciones y Tablas
      for (const section of sections) {
        if (section.title) {
          doc.fontSize(12).fillColor("#1e293b").text(section.title);
          doc.moveDown(0.3);
        }

        if (section.text) {
          doc.fontSize(9).fillColor("#334155").text(section.text);
          doc.moveDown(0.4);
        }

        if (section.metrics && Array.isArray(section.metrics)) {
          doc.fontSize(9).fillColor("#334155");
          for (const m of section.metrics) {
            doc.text(`• ${m.label}: ${m.value}`);
          }
          doc.moveDown(0.6);
        }

        if (section.table && Array.isArray(section.table.rows) && section.table.rows.length > 0) {
          const headers = section.table.headers || [];
          doc.fontSize(8).fillColor("#0f172a").text(headers.join("   |   "));
          doc.strokeColor("#cbd5e1").lineWidth(0.5).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
          doc.moveDown(0.3);

          doc.fontSize(8).fillColor("#334155");
          for (const row of section.table.rows.slice(0, 40)) {
            doc.text(row.join("   |   "));
            doc.moveDown(0.15);
          }
          doc.moveDown(0.8);
        }
      }

      // Pie de página
      doc.fontSize(8).fillColor("#94a3b8").text("CloudBox © 2026 - Documento oficial de administración. Confidencial.", 40, 780, { align: "center", width: 515 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

const ReportService = {
  /**
   * REP-01: Reporte de Suscripciones.
   * Filtra suscripciones vigentes (Activa y PorVencer dentro de vigencia),
   * excluye Pendiente y contabiliza limpiamente las vencidas sin duplicados históricos.
   */
  async getSubscriptionsReport({ from, to } = {}) {
    validateDateRange(from, to);

    const [subscriptions, plans, statuses, users] = await Promise.all([
      readAllSafe("suscripcion", "id,id_usuario,fecha_inicio,fecha_fin,id_plan,id_estado"),
      readAllSafe("plan", "id,nombre,precio,espacio_maximo_gb"),
      readAllSafe("estado_suscripcion", "id,nombre"),
      readAllSafe("usuario", "id,nombre,apellido,correo"),
    ]);

    const planMap = new Map(plans.map(p => [p.id, p]));
    const statusMap = new Map(statuses.map(s => [s.id, s.nombre]));
    const userMap = new Map(users.map(u => [u.id, u]));

    const today = normalizeDateStr(new Date());

    const enriched = subscriptions.map(s => {
      const plan = planMap.get(s.id_plan) || { nombre: "Sin plan", precio: 0, espacio_maximo_gb: 0 };
      const estadoNombre = statusMap.get(s.id_estado) || "Desconocido";
      const user = userMap.get(s.id_usuario) || { nombre: "Desconocido", correo: "" };
      const startDate = normalizeDateStr(s.fecha_inicio);
      const endDate = normalizeDateStr(s.fecha_fin);

      // Regla de vigencia
      const isCommercialState = ["Activa", "PorVencer"].includes(estadoNombre);
      const isDateValid = (!startDate || startDate <= today) && (!endDate || endDate >= today);
      const isVigente = isCommercialState && isDateValid;

      // Regla de vencida limpia
      const isVencida = estadoNombre === "Vencida" || (endDate && endDate < today && !["Cancelada", "Renovada", "Pendiente"].includes(estadoNombre));

      return {
        id: s.id,
        id_usuario: s.id_usuario,
        usuario_nombre: [user.nombre, user.apellido].filter(Boolean).join(" "),
        usuario_correo: user.correo,
        plan_id: plan.id,
        plan_nombre: plan.nombre,
        plan_precio: Number(plan.precio || 0),
        espacio_gb: Number(plan.espacio_maximo_gb || 0),
        id_estado: s.id_estado,
        estado: estadoNombre,
        fecha_inicio: startDate,
        fecha_fin: endDate,
        vigente: isVigente,
        vencida: isVencida,
      };
    });

    // Filtro por período si aplica (evaluado sobre fecha_inicio)
    const filtered = enriched.filter(sub => {
      if (!sub.fecha_inicio) return true;
      if (from && sub.fecha_inicio < from) return false;
      if (to && sub.fecha_inicio > to) return false;
      return true;
    });

    const vigentes = filtered.filter(s => s.vigente);
    const porVencer = filtered.filter(s => s.estado === "PorVencer" && s.vigente);
    const vencidas = filtered.filter(s => s.vencida);
    const pendientes = filtered.filter(s => s.estado === "Pendiente");
    const canceladas = filtered.filter(s => s.estado === "Cancelada");

    // Distribución por plan en suscripciones vigentes
    const planCounts = new Map();
    vigentes.forEach(sub => {
      planCounts.set(sub.plan_nombre, (planCounts.get(sub.plan_nombre) || 0) + 1);
    });

    const distribucionPlanes = Array.from(planCounts.entries()).map(([plan, count]) => ({
      plan,
      cantidad: count,
      porcentaje: vigentes.length > 0 ? Number(((count / vigentes.length) * 100).toFixed(2)) : 0
    }));

    // Tendencia mensual
    const monthlyMap = new Map();
    filtered.forEach(sub => {
      if (!sub.fecha_inicio) return;
      const month = sub.fecha_inicio.substring(0, 7);
      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, { mes: month, total: 0, vigentes: 0, vencidas: 0 });
      }
      const entry = monthlyMap.get(month);
      entry.total += 1;
      if (sub.vigente) entry.vigentes += 1;
      if (sub.vencida) entry.vencidas += 1;
    });

    const tendenciaMensual = Array.from(monthlyMap.values()).sort((a, b) => a.mes.localeCompare(b.mes));

    return {
      periodo: { from: from || null, to: to || null },
      resumen: {
        totalSuscripciones: filtered.length,
        vigentes: vigentes.length,
        porVencer: porVencer.length,
        vencidas: vencidas.length,
        pendientes: pendientes.length,
        canceladas: canceladas.length,
      },
      distribucionPlanes,
      tendenciaMensual,
      suscripciones: filtered,
    };
  },

  /**
   * REP-01: Reporte de Ingresos Simulados (Pagos).
   * Solo transacciones en estado Aprobado (id_estado = 1) y monto > 0.
   * Excluye pagos rechazados, pendientes y créditos.
   */
  async getRevenueReport({ from, to } = {}) {
    validateDateRange(from, to);

    const [pagos, subscriptions, plans, users, paymentStatuses] = await Promise.all([
      readAllSafe("pago", "id,monto,fecha_pago,id_estado,referencia,id_suscripcion"),
      readAllSafe("suscripcion", "id,id_usuario,id_plan"),
      readAllSafe("plan", "id,nombre"),
      readAllSafe("usuario", "id,nombre,apellido,correo"),
      readAllSafe("estado_pago", "id,nombre"),
    ]);

    const subMap = new Map(subscriptions.map(s => [s.id, s]));
    const planMap = new Map(plans.map(p => [p.id, p.nombre]));
    const userMap = new Map(users.map(u => [u.id, u]));
    const statusMap = new Map(paymentStatuses.map(st => [st.id, st.nombre]));

    // Solo transacciones aprobadas (id_estado = 1 o nombre = 'Aprobado') y monto > 0
    const approvedPayments = pagos.filter(p => {
      const stateName = statusMap.get(p.id_estado) || "";
      const isApproved = p.id_estado === 1 || stateName.toLowerCase() === "aprobado";
      const hasPositiveAmount = Number(p.monto) > 0;
      return isApproved && hasPositiveAmount;
    });

    // Enriquecer
    const enriched = approvedPayments.map(p => {
      const dateStr = normalizeDateStr(p.fecha_pago);
      const sub = subMap.get(p.id_suscripcion);
      const planName = sub ? (planMap.get(sub.id_plan) || "Plan Desconocido") : "Plan Comercial";
      const user = sub ? userMap.get(sub.id_usuario) : null;
      const userName = user ? [user.nombre, user.apellido].filter(Boolean).join(" ") : "Cliente CloudBox";
      const userEmail = user?.correo || "";

      return {
        id: p.id,
        monto: Number(Number(p.monto).toFixed(2)),
        fecha_pago: dateStr,
        fecha_completa: p.fecha_pago,
        referencia: p.referencia || `TRANS-${p.id}`,
        id_suscripcion: p.id_suscripcion,
        plan_nombre: planName,
        usuario_nombre: userName,
        usuario_correo: userEmail,
        id_estado: p.id_estado,
        estado: "Aprobado"
      };
    });

    // Filtro de rango de fechas sobre fecha_pago
    const filtered = enriched.filter(p => {
      if (!p.fecha_pago) return true;
      if (from && p.fecha_pago < from) return false;
      if (to && p.fecha_pago > to) return false;
      return true;
    });

    const ingresosTotales = Number(filtered.reduce((sum, p) => sum + p.monto, 0).toFixed(2));
    const totalTransacciones = filtered.length;
    const ticketPromedio = totalTransacciones > 0 ? Number((ingresosTotales / totalTransacciones).toFixed(2)) : 0;

    // Desglose mensual para análisis de tendencias
    const monthlyMap = new Map();
    filtered.forEach(p => {
      if (!p.fecha_pago) return;
      const month = p.fecha_pago.substring(0, 7);
      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, { mes: month, total: 0, transacciones: 0 });
      }
      const entry = monthlyMap.get(month);
      entry.total = Number((entry.total + p.monto).toFixed(2));
      entry.transacciones += 1;
    });

    const desgloseMensual = Array.from(monthlyMap.values()).sort((a, b) => a.mes.localeCompare(b.mes));

    // Desglose por plan
    const planRevenueMap = new Map();
    filtered.forEach(p => {
      const current = planRevenueMap.get(p.plan_nombre) || { plan: p.plan_nombre, total: 0, transacciones: 0 };
      current.total = Number((current.total + p.monto).toFixed(2));
      current.transacciones += 1;
      planRevenueMap.set(p.plan_nombre, current);
    });

    const ingresosPorPlan = Array.from(planRevenueMap.values());

    return {
      periodo: { from: from || null, to: to || null },
      resumen: {
        ingresosTotales,
        totalTransacciones,
        ticketPromedio,
      },
      desgloseMensual,
      ingresosPorPlan,
      transacciones: filtered,
    };
  },

  /**
   * REP-01: Reporte de Usuarios.
   * Registros por período, distribución por estado y rol, tendencia mensual.
   */
  async getUsersReport({ from, to } = {}) {
    validateDateRange(from, to);

    const [users, roles, states] = await Promise.all([
      readAllUsersSafe(),
      readAllSafe("rol", "id,nombre"),
      readAllSafe("estado_usuario", "id,nombre"),
    ]);

    const roleMap = new Map(roles.map(r => [r.id, r.nombre]));
    const stateMap = new Map(states.map(s => [s.id, s.nombre]));

    const enriched = users.map(u => {
      const regDate = normalizeDateStr(u.fecha_registro);
      return {
        id: u.id,
        nombre: u.nombre,
        apellido: u.apellido,
        nombre_completo: [u.nombre, u.apellido].filter(Boolean).join(" "),
        correo: u.correo,
        id_rol: u.id_rol,
        rol: roleMap.get(u.id_rol) || "Cliente",
        id_estado: u.id_estado,
        estado: stateMap.get(u.id_estado) || "Activo",
        espacio_usado_bytes: Number(u.espacio_usado_by ?? u.espacio_usado_bytes ?? 0),
        fecha_registro: regDate,
      };
    });

    const filtered = enriched.filter(u => {
      if (!u.fecha_registro) return true;
      if (from && u.fecha_registro < from) return false;
      if (to && u.fecha_registro > to) return false;
      return true;
    });

    // Distribución por estado
    const stateCounts = new Map();
    filtered.forEach(u => {
      stateCounts.set(u.estado, (stateCounts.get(u.estado) || 0) + 1);
    });
    const distribucionEstado = Array.from(stateCounts.entries()).map(([estado, cantidad]) => ({
      estado,
      cantidad,
      porcentaje: filtered.length > 0 ? Number(((cantidad / filtered.length) * 100).toFixed(2)) : 0
    }));

    // Distribución por rol
    const roleCounts = new Map();
    filtered.forEach(u => {
      roleCounts.set(u.rol, (roleCounts.get(u.rol) || 0) + 1);
    });
    const distribucionRol = Array.from(roleCounts.entries()).map(([rol, cantidad]) => ({
      rol,
      cantidad,
      porcentaje: filtered.length > 0 ? Number(((cantidad / filtered.length) * 100).toFixed(2)) : 0
    }));

    // Tendencia mensual
    const monthlyMap = new Map();
    filtered.forEach(u => {
      if (!u.fecha_registro) return;
      const month = u.fecha_registro.substring(0, 7);
      monthlyMap.set(month, (monthlyMap.get(month) || 0) + 1);
    });
    const tendenciaMensual = Array.from(monthlyMap.entries())
      .map(([mes, nuevosUsuarios]) => ({ mes, nuevosUsuarios }))
      .sort((a, b) => a.mes.localeCompare(b.mes));

    return {
      periodo: { from: from || null, to: to || null },
      resumen: {
        totalPeriodo: filtered.length,
        totalHistorico: users.length,
      },
      distribucionEstado,
      distribucionRol,
      tendenciaMensual,
      usuarios: filtered,
    };
  },

  /**
   * REP-01: Reporte de Almacenamiento.
   * Consumo global, promedio por usuario, usuarios sobre cuota y próximos a cuota.
   */
  async getStorageReport() {
    const [overview, usersStorage] = await Promise.all([
      AdminStorageService.getStorageOverview(),
      AdminStorageService.getStorageUsers({ limit: 1000, offset: 0 }),
    ]);

    const users = usersStorage.users || [];
    const totalUsuarios = users.length;
    const totalBytes = overview.espacio_total_bytes || 0;
    const promedioBytes = totalUsuarios > 0 ? Math.round(totalBytes / totalUsuarios) : 0;
    const promedioGb = Number((promedioBytes / BYTES_PER_GB).toFixed(2));

    const sobreCuota = users.filter(u => u.overQuota);
    const proximosCuota = users.filter(u => !u.overQuota && u.porcentaje_uso >= 80);

    return {
      consumoGlobal: {
        totalBytes: overview.espacio_total_bytes,
        totalGb: overview.espacio_total_gb,
        totalArchivos: overview.total_archivos,
        totalCarpetas: overview.total_carpetas,
      },
      promedioPorUsuario: {
        bytes: promedioBytes,
        gb: promedioGb,
      },
      alertasCuota: {
        totalSobreCuota: sobreCuota.length,
        totalProximosCuota: proximosCuota.length,
        usuariosSobreCuota: sobreCuota,
        usuariosProximosCuota: proximosCuota,
      },
      distribucionTipo: overview.distribucion_tipo,
      distribucionEstado: overview.distribucion_estado,
    };
  },

  /**
   * REP-01: Resumen Consolidado de Métricas (Overview Report).
   */
  async getOverviewReport({ from, to } = {}) {
    const [subscriptions, revenue, users, storage] = await Promise.all([
      this.getSubscriptionsReport({ from, to }),
      this.getRevenueReport({ from, to }),
      this.getUsersReport({ from, to }),
      this.getStorageReport(),
    ]);

    return {
      periodo: { from: from || null, to: to || null },
      kpis: {
        totalUsuarios: users.resumen.totalHistorico,
        nuevosUsuariosPeriodo: users.resumen.totalPeriodo,
        suscripcionesVigentes: subscriptions.resumen.vigentes,
        suscripcionesPorVencer: subscriptions.resumen.porVencer,
        suscripcionesVencidas: subscriptions.resumen.vencidas,
        ingresosTotales: revenue.resumen.ingresosTotales,
        totalTransacciones: revenue.resumen.totalTransacciones,
        espacioConsumidoGb: storage.consumoGlobal.totalGb,
        usuariosSobreCuota: storage.alertasCuota.totalSobreCuota,
      },
      usuarios: {
        distribucionEstado: users.distribucionEstado,
        distribucionRol: users.distribucionRol,
      },
      suscripciones: {
        distribucionPlanes: subscriptions.distribucionPlanes,
      },
      ingresos: {
        desgloseMensual: revenue.desgloseMensual,
        ingresosPorPlan: revenue.ingresosPorPlan,
      },
      almacenamiento: {
        distribucionTipo: storage.distribucionTipo,
        promedioPorUsuarioGb: storage.promedioPorUsuario.gb,
      },
    };
  },

  /**
   * Módulo de Exportación (CSV y PDF) con sanitización de inyección de fórmulas CSV.
   */
  async exportReport({ type, format = "csv", from, to } = {}) {
    validateDateRange(from, to);

    const reportType = String(type).toLowerCase();
    const exportFormat = String(format).toLowerCase();

    if (!["subscriptions", "revenue", "storage", "users", "overview"].includes(reportType)) {
      throw createServiceError("Tipo de reporte inválido. Debe ser: subscriptions, revenue, storage, users u overview", 400, "INVALID_REPORT_TYPE");
    }

    if (!["csv", "pdf"].includes(exportFormat)) {
      throw createServiceError("Formato de exportación inválido. Debe ser 'csv' o 'pdf'", 400, "INVALID_EXPORT_FORMAT");
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);
    const filename = `reporte-${reportType}-${timestamp}.${exportFormat}`;

    if (exportFormat === "csv") {
      let csvContent = "";

      if (reportType === "subscriptions") {
        const data = await this.getSubscriptionsReport({ from, to });
        const headers = ["ID", "Usuario", "Correo", "Plan", "Precio ($)", "Capacidad (GB)", "Estado", "Inicio", "Fin", "Vigente"];
        const rows = (data.suscripciones || []).map(s => [
          s.id,
          s.usuario_nombre,
          s.usuario_correo,
          s.plan_nombre,
          s.plan_precio,
          s.espacio_gb,
          s.estado,
          s.fecha_inicio || "",
          s.fecha_fin || "",
          s.vigente ? "Sí" : "No"
        ]);
        csvContent = generateCsv(headers, rows);
      } else if (reportType === "revenue") {
        const data = await this.getRevenueReport({ from, to });
        const headers = ["ID Transacción", "Monto ($)", "Fecha Pago", "Referencia", "Plan", "Usuario", "Correo", "Estado"];
        const rows = (data.transacciones || []).map(t => [
          t.id,
          t.monto,
          t.fecha_pago || "",
          t.referencia,
          t.plan_nombre,
          t.usuario_nombre,
          t.usuario_correo,
          t.estado
        ]);
        csvContent = generateCsv(headers, rows);
      } else if (reportType === "users") {
        const data = await this.getUsersReport({ from, to });
        const headers = ["ID", "Nombre", "Apellido", "Correo", "Rol", "Estado", "Espacio Usado (Bytes)", "Fecha Registro"];
        const rows = (data.usuarios || []).map(u => [
          u.id,
          u.nombre,
          u.apellido,
          u.correo,
          u.rol,
          u.estado,
          u.espacio_usado_bytes,
          u.fecha_registro || ""
        ]);
        csvContent = generateCsv(headers, rows);
      } else if (reportType === "storage") {
        const data = await AdminStorageService.getStorageUsers({ limit: 1000, offset: 0 });
        const headers = ["ID", "Usuario", "Correo", "Espacio Usado (Bytes)", "Cuota Máxima (Bytes)", "Uso (%)", "Archivos", "Carpetas", "Sobre Cuota"];
        const rows = (data.users || []).map(u => [
          u.id_usuario,
          u.nombre_completo,
          u.correo,
          u.espacio_usado_bytes,
          u.maxBytes,
          u.porcentaje_uso,
          u.cantidad_archivos,
          u.cantidad_carpetas,
          u.overQuota ? "Sí" : "No"
        ]);
        csvContent = generateCsv(headers, rows);
      } else if (reportType === "overview") {
        const data = await this.getOverviewReport({ from, to });
        const headers = ["Métrica KPI", "Valor"];
        const rows = [
          ["Total Usuarios Registrados", data.kpis.totalUsuarios],
          ["Nuevos Usuarios en Período", data.kpis.nuevosUsuariosPeriodo],
          ["Suscripciones Vigentes", data.kpis.suscripcionesVigentes],
          ["Suscripciones Por Vencer", data.kpis.suscripcionesPorVencer],
          ["Suscripciones Vencidas", data.kpis.suscripcionesVencidas],
          ["Ingresos Totales ($)", data.kpis.ingresosTotales],
          ["Total Transacciones Aprobadas", data.kpis.totalTransacciones],
          ["Espacio Consumido Total (GB)", data.kpis.espacioConsumidoGb],
          ["Usuarios en Exceso de Cuota", data.kpis.usuariosSobreCuota]
        ];
        csvContent = generateCsv(headers, rows);
      }

      return {
        filename,
        contentType: "text/csv; charset=utf-8",
        data: csvContent,
      };
    } else {
      // PDF export en memoria con PDFKit
      let title = "Reporte Administrativo";
      let metadata = { periodo: from && to ? `${from} al ${to}` : (from ? `Desde ${from}` : (to ? `Hasta ${to}` : "Histórico completo")) };
      let sections = [];

      if (reportType === "subscriptions") {
        title = "Reporte de Suscripciones Comerciales";
        const data = await this.getSubscriptionsReport({ from, to });
        sections.push({
          title: "Resumen de Suscripciones",
          metrics: [
            { label: "Suscripciones Vigentes", value: data.resumen.vigentes },
            { label: "Próximas a Vencer", value: data.resumen.porVencer },
            { label: "Vencidas", value: data.resumen.vencidas },
            { label: "Pendientes", value: data.resumen.pendientes },
            { label: "Canceladas", value: data.resumen.canceladas },
          ]
        });
        sections.push({
          title: "Detalle de Suscripciones",
          table: {
            headers: ["ID", "Usuario", "Plan", "Estado", "Inicio", "Fin"],
            rows: (data.suscripciones || []).map(s => [
              String(s.id),
              s.usuario_nombre,
              s.plan_nombre,
              s.estado,
              s.fecha_inicio || "-",
              s.fecha_fin || "-"
            ])
          }
        });
      } else if (reportType === "revenue") {
        title = "Reporte Financiero y de Ingresos";
        const data = await this.getRevenueReport({ from, to });
        sections.push({
          title: "Resumen Financiero",
          metrics: [
            { label: "Ingresos Totales", value: `$${data.resumen.ingresosTotales}` },
            { label: "Transacciones Aprobadas", value: data.resumen.totalTransacciones },
            { label: "Ticket Promedio", value: `$${data.resumen.ticketPromedio}` },
          ]
        });
        sections.push({
          title: "Detalle de Transacciones Aprobadas",
          table: {
            headers: ["ID", "Monto ($)", "Fecha", "Plan", "Usuario"],
            rows: (data.transacciones || []).map(t => [
              String(t.id),
              `$${t.monto}`,
              t.fecha_pago || "-",
              t.plan_nombre,
              t.usuario_nombre
            ])
          }
        });
      } else if (reportType === "storage") {
        title = "Reporte de Capacidad y Almacenamiento";
        const data = await this.getStorageReport();
        sections.push({
          title: "Métricas Globales de Almacenamiento",
          metrics: [
            { label: "Espacio Total Consumido", value: `${data.consumoGlobal.totalGb} GB` },
            { label: "Total Archivos Registrados", value: data.consumoGlobal.totalArchivos },
            { label: "Total Carpetas Registradas", value: data.consumoGlobal.totalCarpetas },
            { label: "Promedio por Usuario", value: `${data.promedioPorUsuario.gb} GB` },
            { label: "Usuarios Sobre Cuota", value: data.alertasCuota.totalSobreCuota },
            { label: "Usuarios Próximos a Cuota (>80%)", value: data.alertasCuota.totalProximosCuota },
          ]
        });
      } else if (reportType === "users") {
        title = "Reporte de Usuarios y Roles";
        const data = await this.getUsersReport({ from, to });
        sections.push({
          title: "Resumen de Usuarios",
          metrics: [
            { label: "Usuarios en el Período", value: data.resumen.totalPeriodo },
            { label: "Total Histórico", value: data.resumen.totalHistorico },
          ]
        });
        sections.push({
          title: "Listado de Usuarios",
          table: {
            headers: ["ID", "Nombre", "Correo", "Rol", "Estado"],
            rows: (data.usuarios || []).map(u => [
              String(u.id),
              u.nombre_completo,
              u.correo,
              u.rol,
              u.estado
            ])
          }
        });
      } else if (reportType === "overview") {
        title = "Reporte Ejecutivo Consolidado (Overview)";
        const data = await this.getOverviewReport({ from, to });
        sections.push({
          title: "Métricas Clave del Sistema",
          metrics: [
            { label: "Total Usuarios", value: data.kpis.totalUsuarios },
            { label: "Nuevos Usuarios en Período", value: data.kpis.nuevosUsuariosPeriodo },
            { label: "Suscripciones Vigentes", value: data.kpis.suscripcionesVigentes },
            { label: "Suscripciones Por Vencer", value: data.kpis.suscripcionesPorVencer },
            { label: "Ingresos Totales", value: `$${data.kpis.ingresosTotales}` },
            { label: "Total Transacciones", value: data.kpis.totalTransacciones },
            { label: "Espacio Total Usado", value: `${data.kpis.espacioConsumidoGb} GB` },
            { label: "Usuarios Sobre Cuota", value: data.kpis.usuariosSobreCuota },
          ]
        });
      }

      const pdfBuffer = await generatePdfBuffer(title, metadata, sections);

      return {
        filename,
        contentType: "application/pdf",
        buffer: pdfBuffer,
      };
    }
  },
};

module.exports = ReportService;
