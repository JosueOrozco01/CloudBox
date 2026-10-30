/**
 * Pruebas unitarias para Módulo ADM - Fase 8
 * Validación de getUsersList, getUserById, updateUserStatus, updateUserRole y auditoría AUD-01.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const tables = {
  usuario: [
    { id: 1, auth_user_id: 'auth-1', nombre: 'Admin', apellido: 'Sistema', correo: 'admin@cloudbox.com', id_rol: 1, id_estado: 1, espacio_usado_by: 1000, espacio_usado_bytes: 1000, fecha_registro: '2026-01-01T00:00:00Z' },
    { id: 2, auth_user_id: 'auth-2', nombre: 'Carlos', apellido: 'López', correo: 'carlos@test.com', id_rol: 2, id_estado: 1, espacio_usado_by: 2000, espacio_usado_bytes: 2000, fecha_registro: '2026-02-01T00:00:00Z' },
    { id: 3, auth_user_id: 'auth-3', nombre: 'María', apellido: 'Gómez', correo: 'maria@test.com', id_rol: 2, id_estado: 2, espacio_usado_by: 5000, espacio_usado_bytes: 5000, fecha_registro: '2026-03-01T00:00:00Z' }
  ],

  estado_usuario: [
    { id: 1, nombre: 'Activo' },
    { id: 2, nombre: 'Suspendido' }
  ],
  rol: [
    { id: 1, nombre: 'Administrador' },
    { id: 2, nombre: 'Cliente' }
  ],
  suscripcion: [
    {
      id: 10,
      id_usuario: 2,
      fecha_inicio: '2026-01-01',
      fecha_fin: '2026-12-31',
      id_estado: 2,
      plan: { id: 2, nombre: 'Pro', espacio_maximo_gb: 50 },
      estado: { id: 2, nombre: 'Activa' }
    }
  ],
  LogAuditoria: []
};

const recordedLogs = [];

const db = {
  from(table) {
    let filterCol = null;
    let filterVal = null;
    let orFilter = null;
    let rangeStart = 0;
    let rangeEnd = 999;
    let updatePayload = null;

    return {
      select() { return this; },
      eq(col, val) { filterCol = col; filterVal = val; return this; },
      ilike(col, val) { filterCol = col; filterVal = val; return this; },
      or(str) { orFilter = str; return this; },
      order() { return this; },
      limit() { return this; },
      range(start, end) { rangeStart = start; rangeEnd = end; return this; },
      update(payload) {
        updatePayload = payload;
        return {
          eq(targetCol, targetVal) {
            return {
              select() {
                return {
                  single() {
                    const idx = tables[table].findIndex(r => r[targetCol] === targetVal);
                    if (idx !== -1) {
                      tables[table][idx] = { ...tables[table][idx], ...updatePayload };
                      return Promise.resolve({ data: tables[table][idx], error: null });
                    }
                    return Promise.resolve({ data: null, error: new Error('Not found') });
                  }
                };
              }
            };
          }
        };
      },
      then(resolve, reject) {
        let rows = [...(tables[table] || [])];
        if (filterCol && filterVal !== null) {
          rows = rows.filter(r => {
            const val = r[filterCol];
            if (typeof filterVal === 'string' && typeof val === 'string') {
              return val.toLowerCase() === filterVal.toLowerCase();
            }
            return val === filterVal;
          });
        }
        if (orFilter) {
          // Búsqueda simple en nombre, apellido o correo
          const match = orFilter.match(/%([^%]+)%/);
          if (match) {
            const term = match[1].toLowerCase();
            rows = rows.filter(r =>
              (r.nombre && r.nombre.toLowerCase().includes(term)) ||
              (r.apellido && r.apellido.toLowerCase().includes(term)) ||
              (r.correo && r.correo.toLowerCase().includes(term))
            );
          }
        }
        const count = rows.length;
        const paged = rows.slice(rangeStart, rangeEnd + 1).map(r => {
          if (table === 'usuario') {
            const rol = tables.rol.find(rl => rl.id === r.id_rol);
            const estado = tables.estado_usuario.find(e => e.id === r.id_estado);
            return { ...r, rol, estado };
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
};

const auditService = {
  recordLog: async (log) => {
    recordedLogs.push(log);
  }
};

const serviceContext = {
  require: (name) => {
    if (name.includes('supabase')) return { createClient: () => db };
    if (name.includes('audit.service')) return auditService;
    return require(name);
  },
  process: { env: {} },
  module: { exports: {} },
  console,
  Date,
  Number,
  Map,
  Error,
  parseInt
};

vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, '../src/services/admin.service.js'), 'utf8'),
  serviceContext
);

const AdminService = serviceContext.module.exports;

(async () => {
  console.log('--- TEST FASE 8: MÓDULO ADM (ADMINISTRACIÓN DE USUARIOS) ---');

  // 1. getUsersList con paginación
  {
    const res = await AdminService.getUsersList({ limit: 2, offset: 0 });
    assert.equal(res.users.length, 2, 'Debe paginar a 2 usuarios');
    assert.equal(res.pagination.limit, 2);
    assert.equal(res.pagination.offset, 0);
    assert.equal(res.pagination.total, 3);
    assert.ok(res.users[0].rol, 'Debe incluir rol');
    assert.ok(res.users[0].estado, 'Debe incluir estado');
    console.log('✓ Prueba 1 superada: getUsersList pagina y expone joins descriptivos.');
  }

  // 2. getUsersList con búsqueda textual q
  {
    const res = await AdminService.getUsersList({ q: 'carlos' });
    assert.equal(res.users.length, 1, 'Debe encontrar exactamente 1 usuario para q=carlos');
    assert.equal(res.users[0].correo, 'carlos@test.com');
    console.log('✓ Prueba 2 superada: Búsqueda textual q por nombre/correo.');
  }

  // 3. getUsersList con filtro de status
  {
    const res = await AdminService.getUsersList({ status: 'Suspendido' });
    assert.equal(res.users.length, 1, 'Debe filtrar 1 usuario con estado Suspendido');
    assert.equal(res.users[0].id, 3);
    console.log('✓ Prueba 3 superada: Filtro opcional por status resolviendo contra estado_usuario.');
  }

  // 4. getUserById existente y 404 inexistente
  {
    const user2 = await AdminService.getUserById(2);
    assert.equal(user2.id, 2);
    assert.equal(user2.plan, 'Pro');
    assert.equal(user2.maxBytes, 50 * 1024 ** 3);
    assert.equal(user2.espacio_usado_bytes, 2000);

    await assert.rejects(
      async () => await AdminService.getUserById(999),
      err => {
        assert.equal(err.status, 404);
        assert.equal(err.code, 'USER_NOT_FOUND');
        return true;
      },
      'Debe retornar 404 USER_NOT_FOUND para ID inexistente'
    );
    console.log('✓ Prueba 4 superada: getUserById retorna detalle completo y 404 si no existe.');
  }

  // 5. updateUserStatus: anti-autodesactivación, validación y AUD-01
  {
    // Anti-autodesactivación
    await assert.rejects(
      async () => await AdminService.updateUserStatus(1, 2, { currentUserId: 1 }),
      err => {
        assert.equal(err.status, 400);
        assert.equal(err.code, 'CANNOT_MODIFY_OWN_ACCOUNT');
        return true;
      },
      'Debe prohibir que el administrador suspenda su propia cuenta'
    );

    // Estado inexistente en catálogo
    await assert.rejects(
      async () => await AdminService.updateUserStatus(2, 999, { currentUserId: 1 }),
      err => {
        assert.equal(err.status, 400);
        return true;
      },
      'Debe rechazar estado no existente en el catálogo'
    );

    // Actualización exitosa con auditoría AUD-01
    const beforeCount = recordedLogs.length;
    const updated = await AdminService.updateUserStatus(2, 2, { currentUserId: 1, ip_origen: '127.0.0.1' });
    assert.equal(updated.id_estado, 2);
    assert.equal(recordedLogs.length, beforeCount + 1, 'Debe registrar bitácora AUD-01');
    const log = recordedLogs[recordedLogs.length - 1];
    assert.equal(log.accion, 'CAMBIO_ESTADO_USUARIO');
    assert.equal(log.id_usuario, 1);
    assert.equal(log.id_entidad_afectada, 2);
    assert.ok(log.detalles.anterior);
    assert.ok(log.detalles.nuevo);
    console.log('✓ Prueba 5 superada: updateUserStatus con anti-autodesactivación y AUD-01.');
  }

  // 6. updateUserRole: anti-degradación, validación y AUD-01
  {
    // Anti-degradación
    await assert.rejects(
      async () => await AdminService.updateUserRole(1, 2, { currentUserId: 1 }),
      err => {
        assert.equal(err.status, 400);
        assert.equal(err.code, 'CANNOT_MODIFY_OWN_ROLE');
        return true;
      },
      'Debe prohibir que el administrador degrade su propio rol'
    );

    // Actualización exitosa con auditoría AUD-01
    const beforeCount = recordedLogs.length;
    const updated = await AdminService.updateUserRole(2, 1, { currentUserId: 1, ip_origen: '192.168.1.1' });
    assert.equal(updated.id_rol, 1);
    assert.equal(recordedLogs.length, beforeCount + 1, 'Debe registrar bitácora AUD-01 para rol');
    const log = recordedLogs[recordedLogs.length - 1];
    assert.equal(log.accion, 'CAMBIO_ROL_USUARIO');
    assert.equal(log.id_usuario, 1);
    assert.equal(log.id_entidad_afectada, 2);
    assert.ok(log.detalles.anterior);
    assert.ok(log.detalles.nuevo);
    console.log('✓ Prueba 6 superada: updateUserRole con anti-degradación y AUD-01.');
  }

  console.log('\n============================================================');
  console.log('¡TODAS LAS PRUEBAS DEL MÓDULO ADM (FASE 8) PASARON CON ÉXITO!');
  console.log('============================================================\n');
})().catch(err => {
  console.error('Error en pruebas ADM:', err);
  process.exitCode = 1;
});
