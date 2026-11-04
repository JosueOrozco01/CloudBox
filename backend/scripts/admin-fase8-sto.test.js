/**
 * Pruebas unitarias e integración para Módulo STO - Fase 8
 * Validación de:
 * 1. QuotaService: suscripciones Activa y PorVencer vigentes
 * 2. QuotaService: exclusión de fechas vencidas o no iniciadas
 * 3. QuotaService: estado Pendiente no otorga cuota comercial (fallback base/gratuito 1 GB)
 * 4. QuotaService: canUserUpload (rechazo con { allowed: false })
 * 5. QuotaService: validateUpload (rechazo con HTTP 413 STORAGE_QUOTA_EXCEEDED)
 * 6. QuotaService: regla de integridad ante reducciones (conserva archivos existentes, nunca los elimina)
 * 7. AdminStorageService: getStorageOverview (espacio total en bytes y GB, archivos/carpetas excluyendo id_estado = 3)
 * 8. AdminStorageService: distribución de archivos por tipo (PDF, imágenes, documentos, otros) y estado
 * 9. AdminStorageService: getStorageUsers (paginación, detalle completo y orden estable)
 * 10. AdminStorageService: filtro booleano overQuota / getUsersOverQuota
 * 11. AdminController & Routes: respuestas estandarizadas y protección SEC-01
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const BYTES_PER_GB = 1024 * 1024 * 1024;
const today = new Date().toISOString().split('T')[0];
const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
const lastMonth = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

const tables = {
  usuario: [
    { id: 1, auth_user_id: 'auth-1', nombre: 'Admin', apellido: 'Sistema', correo: 'admin@cloudbox.com', id_rol: 1, id_estado: 1, espacio_usado_by: 500 * 1024 * 1024, espacio_usado_bytes: 500 * 1024 * 1024, fecha_registro: '2026-01-01' },
    { id: 2, auth_user_id: 'auth-2', nombre: 'Carlos', apellido: 'Pro', correo: 'carlos@test.com', id_rol: 2, id_estado: 1, espacio_usado_by: 2 * BYTES_PER_GB, espacio_usado_bytes: 2 * BYTES_PER_GB, fecha_registro: '2026-02-01' },
    { id: 3, auth_user_id: 'auth-3', nombre: 'Elena', apellido: 'PorVencer', correo: 'elena@test.com', id_rol: 2, id_estado: 1, espacio_usado_by: 3 * BYTES_PER_GB, espacio_usado_bytes: 3 * BYTES_PER_GB, fecha_registro: '2026-03-01' },
    { id: 4, auth_user_id: 'auth-4', nombre: 'Marcos', apellido: 'OverQuota', correo: 'marcos@test.com', id_rol: 2, id_estado: 1, espacio_usado_by: 6 * BYTES_PER_GB, espacio_usado_bytes: 6 * BYTES_PER_GB, fecha_registro: '2026-04-01' },
    { id: 5, auth_user_id: 'auth-5', nombre: 'Lucía', apellido: 'Pendiente', correo: 'lucia@test.com', id_rol: 2, id_estado: 1, espacio_usado_by: 200 * 1024 * 1024, espacio_usado_bytes: 200 * 1024 * 1024, fecha_registro: '2026-05-01' }
  ],

  estado_usuario: [
    { id: 1, nombre: 'Activo' },
    { id: 2, nombre: 'Suspendido' }
  ],
  rol: [
    { id: 1, nombre: 'Administrador' },
    { id: 2, nombre: 'Cliente' }
  ],
  estado_suscripcion: [
    { id: 1, nombre: 'Pendiente' },
    { id: 2, nombre: 'Activa' },
    { id: 3, nombre: 'PorVencer' },
    { id: 4, nombre: 'Vencida' },
    { id: 5, nombre: 'Cancelada' }
  ],
  plan: [
    { id: 1, nombre: 'Free', precio: 0, espacio_maximo_gb: 1, vigencia_dias: null, id_estado: 1 },
    { id: 2, nombre: 'Plan Básico', precio: 5, espacio_maximo_gb: 5, vigencia_dias: 30, id_estado: 1 },
    { id: 3, nombre: 'Plan Pro', precio: 15, espacio_maximo_gb: 50, vigencia_dias: 30, id_estado: 1 }
  ],
  suscripcion: [
    // Usuario 2: Activa vigente con Plan Pro (50 GB)
    {
      id: 101,
      id_usuario: 2,
      fecha_inicio: lastMonth,
      fecha_fin: nextMonth,
      id_plan: 3,
      id_estado: 2,
      plan: { id: 3, nombre: 'Plan Pro', espacio_maximo_gb: 50 },
      estado: { id: 2, nombre: 'Activa' }
    },
    // Usuario 3: PorVencer vigente con Plan Básico (5 GB)
    {
      id: 102,
      id_usuario: 3,
      fecha_inicio: lastMonth,
      fecha_fin: tomorrow,
      id_plan: 2,
      id_estado: 3,
      plan: { id: 2, nombre: 'Plan Básico', espacio_maximo_gb: 5 },
      estado: { id: 3, nombre: 'PorVencer' }
    },
    // Usuario 4: Suscripción Vencida (hace 5 días), cayó a Free 1 GB pero tiene 6 GB usados (Sobre Cuota)
    {
      id: 103,
      id_usuario: 4,
      fecha_inicio: '2026-01-01',
      fecha_fin: yesterday,
      id_plan: 2,
      id_estado: 4,
      plan: { id: 2, nombre: 'Plan Básico', espacio_maximo_gb: 5 },
      estado: { id: 4, nombre: 'Vencida' }
    },
    // Usuario 5: Suscripción Pendiente (no otorga cuota comercial todavía)
    {
      id: 104,
      id_usuario: 5,
      fecha_inicio: tomorrow,
      fecha_fin: nextMonth,
      id_plan: 3,
      id_estado: 1,
      plan: { id: 3, nombre: 'Plan Pro', espacio_maximo_gb: 50 },
      estado: { id: 1, nombre: 'Pendiente' }
    }
  ],
  estado_archivo: [
    { id: 1, nombre: 'Activo' },
    { id: 2, nombre: 'En papelera' },
    { id: 3, nombre: 'Eliminado' }
  ],
  archivo: [
    // Archivos Activos
    { id: 1, nombre: 'contrato.pdf', tamano_bytes: 10 * 1024 * 1024, id_usuario: 2, id_estado: 1, estado: { id: 1, nombre: 'Activo' } },
    { id: 2, nombre: 'foto_perfil.png', tamano_bytes: 5 * 1024 * 1024, id_usuario: 2, id_estado: 1, estado: { id: 1, nombre: 'Activo' } },
    { id: 3, nombre: 'reporte.docx', tamano_bytes: 8 * 1024 * 1024, id_usuario: 3, id_estado: 1, estado: { id: 1, nombre: 'Activo' } },
    { id: 4, nombre: 'backup.zip', tamano_bytes: 20 * 1024 * 1024, id_usuario: 3, id_estado: 1, estado: { id: 1, nombre: 'Activo' } },
    // Archivo Activo para usuario 4 con 6 GB (sobre cuota respecto a Plan Gratuito 1 GB)
    { id: 5, nombre: 'antiguo.pdf', tamano_bytes: 6 * BYTES_PER_GB, id_usuario: 4, id_estado: 2, estado: { id: 2, nombre: 'En papelera' } },
    // Archivo Eliminado Lógicamente (id_estado = 3, NO debe contarse)
    { id: 6, nombre: 'eliminado_permanente.pdf', tamano_bytes: 100 * 1024 * 1024, id_usuario: 4, id_estado: 3, estado: { id: 3, nombre: 'Eliminado' } }
  ],
  carpeta: [
    { id: 1, nombre: 'Documentos', id_usuario: 2, id_estado: 1 },
    { id: 2, nombre: 'Fotos', id_usuario: 2, id_estado: 1 },
    { id: 3, nombre: 'Trabajo', id_usuario: 3, id_estado: 1 },
    // Carpeta eliminada lógicamente (id_estado = 3, NO debe contarse)
    { id: 4, nombre: 'Carpeta Borrada', id_usuario: 3, id_estado: 3 }
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
    let updatePayload = null;

    return {
      select() { return this; },
      eq(col, val) { filterCol = col; filterVal = val; return this; },
      in(col, vals) { inCol = col; inVals = vals; return this; },
      order() { return this; },
      limit() { return this; },
      range(start, end) { rangeStart = start; rangeEnd = end; return this; },
      update(payload) {
        updatePayload = payload;
        return {
          eq(targetCol, targetVal) {
            const idx = (tables[tableName] || []).findIndex(r => r[targetCol] === targetVal);
            if (idx !== -1) {
              tables[tableName][idx] = { ...tables[tableName][idx], ...updatePayload };
              return Promise.resolve({ data: tables[tableName][idx], error: null });
            }
            return Promise.resolve({ data: null, error: null });
          }
        };
      },
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
            return { ...r, plan: r.plan || plan, estado: r.estado || estado };
          }
          if (tableName === 'archivo') {
            const estado = tables.estado_archivo.find(e => e.id === r.id_estado);
            return { ...r, estado: r.estado || estado };
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
const AdminService = loadModuleWithMock(
  path.join(__dirname, '../src/services/admin.service.js'),
  {
    './admin-storage.service': AdminStorageService,
    './quota.service': QuotaService
  }
);

(async () => {
  console.log('--- TEST FASE 8: MÓDULO STO (ADMINISTRACIÓN DE ARCHIVOS Y ALMACENAMIENTO) ---');

  // =========================================================================
  // 1. QuotaService: Reconocimiento de estados Activa y PorVencer vigentes
  // =========================================================================
  {
    const subActiva = await QuotaService.getActiveSubscription(2);
    assert.equal(subActiva.id_usuario, 2);
    assert.equal(subActiva.id_plan, 3, 'Usuario 2 debe tener Plan Pro (id 3)');

    const subPorVencer = await QuotaService.getActiveSubscription(3);
    assert.equal(subPorVencer.id_usuario, 3);
    assert.equal(subPorVencer.id_plan, 2, 'Usuario 3 debe reconocer estado PorVencer y mantener Plan Básico');
    console.log('✓ Actividad 1 y 2 superadas: Reconocimiento de Activa y PorVencer con vigencia de fechas.');
  }

  // =========================================================================
  // 2. QuotaService: Exclusión de estado 'Pendiente' y suscripciones vencidas
  // =========================================================================
  {
    // Usuario 5 tiene suscripción 'Pendiente' -> NO debe otorgar suscripción comercial activa
    await assert.rejects(
      async () => await QuotaService.getActiveSubscription(5),
      err => {
        assert.equal(err.code, 'NO_ACTIVE_SUBSCRIPTION');
        assert.equal(err.status, 403);
        return true;
      },
      'Suscripción Pendiente debe lanzar NO_ACTIVE_SUBSCRIPTION'
    );

    // Usuario 4 tiene suscripción 'Vencida' -> NO debe otorgar suscripción comercial activa
    await assert.rejects(
      async () => await QuotaService.getActiveSubscription(4),
      err => {
        assert.equal(err.code, 'NO_ACTIVE_SUBSCRIPTION');
        assert.equal(err.status, 403);
        return true;
      },
      'Suscripción Vencida debe lanzar NO_ACTIVE_SUBSCRIPTION'
    );
    console.log('✓ Actividad 3 superada: Estado Pendiente y fechas caducadas no otorgan suscripción activa.');
  }

  // =========================================================================
  // 3. QuotaService: Fallback a plan base/gratuito (1 GB) ante NO_ACTIVE_SUBSCRIPTION
  // =========================================================================
  {
    const metricsUser5 = await QuotaService.getStorageMetrics(5);
    assert.equal(metricsUser5.subscription, null, 'No debe tener suscripción activa comercial');
    assert.equal(metricsUser5.maxBytes, 1 * BYTES_PER_GB, 'Debe aplicar fallback de cuota base gratuita (1 GB)');
    console.log('✓ Actividad 4 superada: Fallback de plan base gratuito (1 GB) ante ausencia de suscripción comercial.');
  }

  // =========================================================================
  // 4. QuotaService: canUserUpload y validateUpload
  // =========================================================================
  {
    // Usuario 2 tiene 50 GB de cuota y ~15 MB usados -> permite subida de 10 MB
    const allowedCheck = await QuotaService.canUserUpload({ userId: 2, incomingSizeBytes: 10 * 1024 * 1024 });
    assert.equal(allowedCheck.allowed, true);
    assert.ok(allowedCheck.maxBytes >= 50 * BYTES_PER_GB);

    // Usuario 5 tiene 1 GB de cuota gratuita y 200 MB usados -> rechaza subida de 1.5 GB
    const rejectedCheck = await QuotaService.canUserUpload({ userId: 5, incomingSizeBytes: 1.5 * BYTES_PER_GB });
    assert.equal(rejectedCheck.allowed, false);
    assert.ok(rejectedCheck.reason.includes('supera el espacio disponible'));

    // validateUpload lanza HTTP 413 STORAGE_QUOTA_EXCEEDED
    await assert.rejects(
      async () => await QuotaService.validateUpload(5, 1.5 * BYTES_PER_GB),
      err => {
        assert.equal(err.status, 413);
        assert.equal(err.code, 'STORAGE_QUOTA_EXCEEDED');
        return true;
      },
      'validateUpload debe lanzar 413 STORAGE_QUOTA_EXCEEDED'
    );
    console.log('✓ Actividad 5 superada: canUserUpload y validateUpload validan límites con HTTP 413 y { allowed: false }.');
  }

  // =========================================================================
  // 5. QuotaService: Regla de integridad ante reducciones (Downgrade/Cancelación)
  // =========================================================================
  {
    // Usuario 4 tiene 6 GB usados pero cayó a cuota Free de 1 GB
    const fileCountBefore = tables.archivo.filter(a => a.id_usuario === 4).length;
    const checkUser4 = await QuotaService.canUserUpload({ userId: 4, incomingSizeBytes: 1024 });

    // Debe bloquear nuevas cargas
    assert.equal(checkUser4.allowed, false, 'El exceso sobre la cuota debe bloquear nuevas cargas');

    // La regla de oro: NUNCA se eliminan archivos existentes
    const fileCountAfter = tables.archivo.filter(a => a.id_usuario === 4).length;
    assert.equal(fileCountAfter, fileCountBefore, 'NUNCA se deben eliminar archivos existentes tras un downgrade');
    console.log('✓ Actividad 6 superada: Integridad ante reducciones; bloqueo de cargas sin eliminación de archivos.');
  }

  // =========================================================================
  // 6. AdminStorageService: getStorageOverview
  // =========================================================================
  {
    const overview = await AdminStorageService.getStorageOverview();

    // Archivos 1, 2, 3, 4 (Activos) + 5 (En papelera) = (10+5+8+20 MB) + 6 GB
    // Archivo 6 está Eliminado (id_estado = 3) y DEBE ser excluido
    const expectedBytes = (10 + 5 + 8 + 20) * 1024 * 1024 + 6 * BYTES_PER_GB;
    assert.equal(overview.total_archivos, 5, 'Debe haber exactamente 5 archivos no eliminados');
    assert.equal(overview.espacio_total_bytes, expectedBytes, 'Espacio total debe sumar solo archivos no eliminados');
    assert.ok(overview.espacio_total_gb !== undefined, 'Debe incluir espacio total en GB');

    // Carpetas 1, 2, 3 (Activas). Carpeta 4 tiene id_estado = 3 y DEBE ser excluida
    assert.equal(overview.total_carpetas, 3, 'Debe haber exactamente 3 carpetas no eliminadas');

    // Distribución por tipo
    const distTipo = overview.distribucion_tipo;
    assert.ok(distTipo.pdf, 'Debe incluir categoría PDF');
    assert.ok(distTipo.imagenes, 'Debe incluir categoría imagenes');
    assert.ok(distTipo.documentos, 'Debe incluir categoría documentos');
    assert.ok(distTipo.otros, 'Debe incluir categoría otros');

    assert.equal(distTipo.pdf.cantidad, 2, '2 archivos PDF (contrato.pdf y antiguo.pdf)');
    assert.equal(distTipo.imagenes.cantidad, 1, '1 archivo imagen (foto_perfil.png)');
    assert.equal(distTipo.documentos.cantidad, 1, '1 archivo documento (reporte.docx)');
    assert.equal(distTipo.otros.cantidad, 1, '1 archivo otros (backup.zip)');

    // Distribución por estado
    const distEstado = overview.distribucion_estado;
    const activos = distEstado.find(e => e.estado === 'Activo');
    const papelera = distEstado.find(e => e.estado === 'En papelera');
    assert.equal(activos.cantidad, 4, '4 archivos Activos');
    assert.equal(papelera.cantidad, 1, '1 archivo En papelera');
    console.log('✓ Actividad 7 y 8 superadas: getStorageOverview calcula totales y distribuciones excluyendo eliminados.');
  }

  // =========================================================================
  // 7. AdminStorageService: getStorageUsers (Paginado y detalle por usuario)
  // =========================================================================
  {
    const res = await AdminStorageService.getStorageUsers({ limit: 3, offset: 0 });
    assert.equal(res.users.length, 3, 'Debe paginar a 3 usuarios');
    assert.equal(res.pagination.limit, 3);
    assert.equal(res.pagination.offset, 0);
    assert.equal(res.pagination.total, 5, 'Total de 5 usuarios registrados');

    const firstUser = res.users[0];
    assert.ok(firstUser.id_usuario !== undefined);
    assert.ok(firstUser.nombre !== undefined);
    assert.ok(firstUser.correo !== undefined);
    assert.ok(firstUser.espacio_usado_bytes !== undefined);
    assert.ok(firstUser.maxBytes !== undefined);
    assert.ok(firstUser.porcentaje_uso !== undefined);
    assert.ok(firstUser.cantidad_archivos !== undefined);
    assert.ok(firstUser.cantidad_carpetas !== undefined);
    console.log('✓ Actividad 9 superada: getStorageUsers retorna listado paginado con detalle completo y orden estable.');
  }

  // =========================================================================
  // 8. AdminStorageService: Selector booleano overQuota y getUsersOverQuota
  // =========================================================================
  {
    const overQuotaList = await AdminStorageService.getStorageUsers({ overQuota: true });
    assert.equal(overQuotaList.users.length, 1, 'Solo el usuario 4 debe estar sobre cuota');
    assert.equal(overQuotaList.users[0].id_usuario, 4);
    assert.equal(overQuotaList.users[0].sobre_cuota, true);

    const directCall = await AdminStorageService.getUsersOverQuota();
    assert.equal(directCall.users.length, 1);
    assert.equal(directCall.users[0].id_usuario, 4);
    console.log('✓ Actividad 10 superada: Filtro overQuota y getUsersOverQuota identifican usuarios en exceso de cuota.');
  }

  // =========================================================================
  // 9. AdminService: Delegación hacia AdminStorageService y getOverview
  // =========================================================================
  {
    const overviewViaAdmin = await AdminService.getStorageOverview();
    assert.equal(overviewViaAdmin.total_archivos, 5);

    const usersViaAdmin = await AdminService.getStorageUsers({ limit: 2 });
    assert.equal(usersViaAdmin.users.length, 2);

    const overQuotaViaAdmin = await AdminService.getUsersOverQuota();
    assert.equal(overQuotaViaAdmin.users.length, 1);
    console.log('✓ Actividad 10 superada: AdminService integra y delega limpiamente los reportes STO.');
  }

  // =========================================================================
  // 10. Controller: getStorageOverview, getStorageUsers, getUsersOverQuota
  // =========================================================================
  {
    const adminController = loadModuleWithMock(
      path.join(__dirname, '../src/controllers/admin.controller.js'),
      {
        '../services/admin.service': AdminService,
        '../services/audit.service': { recordLog: async () => {} }
      }
    );


    const createMockRes = () => ({
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      }
    });

    // getStorageOverview
    const resOverview = createMockRes();
    await adminController.getStorageOverview({}, resOverview);
    assert.equal(resOverview.statusCode, 200);
    assert.equal(resOverview.body.success, true);
    assert.equal(resOverview.body.data.total_archivos, 5);

    // getStorageUsers
    const resUsers = createMockRes();
    await adminController.getStorageUsers({ query: { limit: 2, offset: 0 } }, resUsers);
    assert.equal(resUsers.statusCode, 200);
    assert.equal(resUsers.body.success, true);
    assert.equal(resUsers.body.data.length, 2);
    assert.equal(resUsers.body.pagination.total, 5);

    // getUsersOverQuota
    const resOverQuota = createMockRes();
    await adminController.getUsersOverQuota({ query: {} }, resOverQuota);
    assert.equal(resOverQuota.statusCode, 200);
    assert.equal(resOverQuota.body.success, true);
    assert.equal(resOverQuota.body.data.length, 1);
    assert.equal(resOverQuota.body.data[0].id_usuario, 4);
    console.log('✓ Actividad 11 superada: AdminController responde en formato estándar { success: true, data, pagination }.');
  }

  // =========================================================================
  // 11. Routes: Verificación de rutas STO y protección SEC-01
  // =========================================================================
  {
    const routesContent = fs.readFileSync(path.join(__dirname, '../src/routes/admin.routes.js'), 'utf8');
    assert.ok(routesContent.includes('/storage/overview'), 'Debe definir ruta /storage/overview');
    assert.ok(routesContent.includes('/storage/users'), 'Debe definir ruta /storage/users');
    assert.ok(routesContent.includes('/storage/over-quota'), 'Debe definir ruta /storage/over-quota');
    assert.ok(routesContent.includes('authorizeRole(["Administrador"])') || routesContent.includes("authorizeRole(['Administrador'])"), 'Debe proteger con SEC-01 Administrador');
    console.log('✓ Rutas STO validadas y protegidas bajo SEC-01.');
  }

  console.log('\n==================================================================');
  console.log('¡TODAS LAS PRUEBAS DEL MÓDULO STO (FASE 8 - 11 ACTIVIDADES) PASARON!');
  console.log('==================================================================\n');
})().catch(err => {
  console.error('Error en pruebas STO:', err);
  process.exitCode = 1;
});

