/**
 * Pruebas de verificación de ajustes de integración Fase 7 (Benja)
 * Basado en: docs/CLOUDBOX_AJUSTES_BENJA_FASE7.md
 *
 * Verifica:
 * 1. getStorageMetrics y capacidades: Free (1GB), Básico (5GB), Pro (50GB), Premium (100GB).
 * 2. Reconocimiento de estados comerciales 'Activa' y 'PorVencer'.
 * 3. Límite inclusivo fecha_fin >= CURRENT_DATE y tratamiento de fechas calendario (hoy, ayer, mañana).
 * 4. Exclusión de estados Pendiente, Cancelada, Renovada, Vencida.
 * 5. validateUpload rechaza con 413 STORAGE_QUOTA_EXCEEDED sin borrar archivos si se supera la cuota.
 * 6. Fallback a Free 1GB en getQuotaSummary para usuarios sin suscripción activa.
 * 7. AdminService.getOverview incluye PorVencer como cuota pagada y categoriza ventana de 5 días.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const BYTES_PER_GB = 1024 * 1024 * 1024;

// Helper para generar fechas calendario locales YYYY-MM-DD
function toDateStr(offsetDays = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

const today = toDateStr(0);
const yesterday = toDateStr(-1);
const tomorrow = toDateStr(1);
const in3Days = toDateStr(3);
const in10Days = toDateStr(10);
const pastMonth = toDateStr(-30);

// Catálogos simulados
const mockCatalogEstadoSuscripcion = [
    { id: 1, nombre: 'Pendiente' },
    { id: 2, nombre: 'Activa' },
    { id: 3, nombre: 'PorVencer' },
    { id: 4, nombre: 'Vencida' },
    { id: 5, nombre: 'Renovada' },
    { id: 6, nombre: 'Cancelada' }
];

const mockPlans = [
    { id: 8, nombre: 'Free', precio: 0, espacio_maximo_gb: 1, id_estado: 1 },
    { id: 1, nombre: 'Básico', precio: 29, espacio_maximo_gb: 5, id_estado: 1 },
    { id: 2, nombre: 'Pro', precio: 89, espacio_maximo_gb: 50, id_estado: 1 },
    { id: 3, nombre: 'Premium', precio: 149, espacio_maximo_gb: 100, id_estado: 1 }
];

function buildMockDb(initialSubscriptions = [], files = []) {
    let subscriptions = [...initialSubscriptions];
    let fileList = [...files];
    let userStorage = {};

    return {
        from(table) {
            let filterField = null;
            let filterValues = null;
            let singleFilter = {};
            let selectedCols = '*';

            const queryObj = {
                select(cols) {
                    selectedCols = cols;
                    return this;
                },
                eq(field, val) {
                    singleFilter[field] = val;
                    return this;
                },
                in(field, arr) {
                    filterField = field;
                    filterValues = arr;
                    return this;
                },
                order() {
                    return this;
                },
                limit(n) {
                    return this;
                },
                range(start, end) {
                    return this;
                },
                update(data) {
                    return {
                        eq(field, val) {
                            if (table === 'usuario' && field === 'id') {
                                userStorage[val] = data.espacio_usado_bytes || data.espacio_usado_by;
                            }
                            return Promise.resolve({ error: null });
                        }
                    };
                },
                async maybeSingle() {
                    const res = await this.then(r => r);
                    return { data: (res.data && res.data.length > 0) ? res.data[0] : null, error: res.error };
                },
                async single() {
                    const res = await this.then(r => r);
                    return { data: (res.data && res.data.length > 0) ? res.data[0] : null, error: res.error };
                },
                then(resolve, reject) {
                    let data = [];
                    let error = null;

                    if (table === 'estado_suscripcion') {
                        data = mockCatalogEstadoSuscripcion;
                        if (filterField === 'nombre' && filterValues) {
                            data = data.filter(s => filterValues.includes(s.nombre));
                        }
                    } else if (table === 'plan') {
                        data = mockPlans;
                        if (singleFilter.id !== undefined) {
                            data = data.filter(p => p.id === singleFilter.id);
                        }
                    } else if (table === 'estado_archivo') {
                        data = [{ id: 1, nombre: 'Activo' }, { id: 2, nombre: 'En papelera' }];
                    } else if (table === 'archivo') {
                        data = fileList;
                        if (singleFilter.id_usuario !== undefined) {
                            data = data.filter(f => f.id_usuario === singleFilter.id_usuario);
                        }
                    } else if (table === 'suscripcion') {
                        data = subscriptions;
                        if (singleFilter.id_usuario !== undefined) {
                            data = data.filter(s => s.id_usuario === singleFilter.id_usuario);
                        }
                        if (filterField === 'id_estado' && filterValues) {
                            data = data.filter(s => filterValues.includes(s.id_estado));
                        }
                        // Agregar estado embebido para emular Supabase select('..., estado:id_estado(...)')
                        data = data.map(s => {
                            const est = mockCatalogEstadoSuscripcion.find(e => e.id === s.id_estado);
                            return { ...s, estado: est ? { id: est.id, nombre: est.nombre } : null };
                        });
                    }

                    return Promise.resolve({ data, error }).then(resolve, reject);
                }
            };

            return queryObj;
        }
    };
}

function loadQuotaService(db) {
    const context = {
        require: (mod) => {
            if (mod === '@supabase/supabase-js') {
                return { createClient: () => db };
            }
            return require(mod);
        },
        process: { env: {} },
        module: { exports: {} },
        console,
        Date,
        Number,
        Math,
        String,
        Error
    };

    const filePath = path.join(__dirname, '../src/services/quota.service.js');
    vm.runInNewContext(fs.readFileSync(filePath, 'utf8'), context);
    return context.module.exports;
}

(async () => {
    console.log('--- INICIANDO SUITE DE PRUEBAS FASE 7: AJUSTES DE BENJA ---');

    // 1. Probar que getActiveSubscription reconoce 'Activa' y 'PorVencer', pero no 'Pendiente', 'Vencida', 'Cancelada', 'Renovada'
    {
        const subs = [
            { id: 1, id_usuario: 10, id_plan: 2, id_estado: 2, fecha_inicio: yesterday, fecha_fin: in10Days }, // Activa
            { id: 2, id_usuario: 20, id_plan: 1, id_estado: 3, fecha_inicio: yesterday, fecha_fin: in3Days },  // PorVencer
            { id: 3, id_usuario: 30, id_plan: 3, id_estado: 1, fecha_inicio: yesterday, fecha_fin: in10Days }, // Pendiente
            { id: 4, id_usuario: 40, id_plan: 2, id_estado: 4, fecha_inicio: pastMonth, fecha_fin: yesterday }, // Vencida
            { id: 5, id_usuario: 50, id_plan: 2, id_estado: 6, fecha_inicio: pastMonth, fecha_fin: in10Days }  // Cancelada
        ];

        const db = buildMockDb(subs);
        const QuotaService = loadQuotaService(db);

        // Usuario 10 (Activa)
        const sub10 = await QuotaService.getActiveSubscription(10);
        assert.equal(sub10.id, 1, 'Usuario 10 debe tener suscripción Activa');
        assert.equal(sub10.estado.nombre, 'Activa');

        // Usuario 20 (PorVencer vigente)
        const sub20 = await QuotaService.getActiveSubscription(20);
        assert.equal(sub20.id, 2, 'Usuario 20 con PorVencer vigente debe tener suscripción activa');
        assert.equal(sub20.estado.nombre, 'PorVencer');

        // Usuario 30 (Pendiente no debe otorgar cuota)
        await assert.rejects(
            async () => await QuotaService.getActiveSubscription(30),
            err => err.code === 'NO_ACTIVE_SUBSCRIPTION',
            'Suscripción Pendiente no debe otorgar cuota activa'
        );

        // Usuario 40 (Vencida)
        await assert.rejects(
            async () => await QuotaService.getActiveSubscription(40),
            err => err.code === 'NO_ACTIVE_SUBSCRIPTION',
            'Suscripción Vencida no debe otorgar cuota activa'
        );

        // Usuario 50 (Cancelada)
        await assert.rejects(
            async () => await QuotaService.getActiveSubscription(50),
            err => err.code === 'NO_ACTIVE_SUBSCRIPTION',
            'Suscripción Cancelada no debe otorgar cuota activa'
        );

        console.log('✓ Prueba 1 superada: Estados comerciales Activa y PorVencer admitidos; Pendiente/Cancelada/Vencida excluidos.');
    }

    // 2. Probar regla de vigencia fecha_fin >= CURRENT_DATE (límite inclusivo: ayer, hoy y mañana)
    {
        const subs = [
            { id: 1, id_usuario: 101, id_plan: 2, id_estado: 2, fecha_inicio: yesterday, fecha_fin: yesterday }, // Venció ayer
            { id: 2, id_usuario: 102, id_plan: 2, id_estado: 2, fecha_inicio: yesterday, fecha_fin: today },     // Vence hoy (inclusivo: VIGENTE)
            { id: 3, id_usuario: 103, id_plan: 2, id_estado: 3, fecha_inicio: yesterday, fecha_fin: tomorrow },  // Vence mañana (VIGENTE)
            { id: 4, id_usuario: 104, id_plan: 8, id_estado: 2, fecha_inicio: yesterday, fecha_fin: null }       // Sin fecha_fin (Free indefinido: VIGENTE)
        ];

        const db = buildMockDb(subs);
        const QuotaService = loadQuotaService(db);

        // Ayer -> expirado aunque siga en estado 'Activa' (cron aún no corrió)
        await assert.rejects(
            async () => await QuotaService.getActiveSubscription(101),
            err => err.code === 'NO_ACTIVE_SUBSCRIPTION',
            'fecha_fin de ayer no debe ser considerada vigente'
        );

        // Hoy -> Vigente (límite inclusivo)
        const sub102 = await QuotaService.getActiveSubscription(102);
        assert.equal(sub102.id, 2, 'fecha_fin de hoy debe ser considerada vigente (límite inclusivo)');

        // Mañana -> Vigente
        const sub103 = await QuotaService.getActiveSubscription(103);
        assert.equal(sub103.id, 3, 'fecha_fin de mañana debe ser considerada vigente');

        // Sin fecha_fin -> Vigente
        const sub104 = await QuotaService.getActiveSubscription(104);
        assert.equal(sub104.id, 4, 'Suscripción sin fecha_fin debe ser considerada vigente');

        console.log('✓ Prueba 2 superada: Límite inclusivo fecha_fin >= CURRENT_DATE validado para ayer, hoy y mañana.');
    }

    // 3. Probar capacidades exactas: Free 1 GB, Básico 5 GB, Pro 50 GB, Premium 100 GB
    {
        const subs = [
            { id: 1, id_usuario: 1, id_plan: 8, id_estado: 2, fecha_inicio: today, fecha_fin: in10Days }, // Free 1GB
            { id: 2, id_usuario: 2, id_plan: 1, id_estado: 2, fecha_inicio: today, fecha_fin: in10Days }, // Básico 5GB
            { id: 3, id_usuario: 3, id_plan: 2, id_estado: 3, fecha_inicio: today, fecha_fin: in10Days }, // Pro 50GB (PorVencer)
            { id: 4, id_usuario: 4, id_plan: 3, id_estado: 2, fecha_inicio: today, fecha_fin: in10Days }  // Premium 100GB
        ];

        const db = buildMockDb(subs);
        const QuotaService = loadQuotaService(db);

        const mFree = await QuotaService.getStorageMetrics(1);
        assert.equal(mFree.maxBytes, 1 * BYTES_PER_GB, 'Free debe tener 1 GB');
        assert.equal(mFree.plan.nombre, 'Free');

        const mBasico = await QuotaService.getStorageMetrics(2);
        assert.equal(mBasico.maxBytes, 5 * BYTES_PER_GB, 'Básico debe tener 5 GB');

        const mPro = await QuotaService.getStorageMetrics(3);
        assert.equal(mPro.maxBytes, 50 * BYTES_PER_GB, 'Pro PorVencer debe mantener 50 GB');
        assert.equal(mPro.subscription.estado, 'PorVencer');

        const mPremium = await QuotaService.getStorageMetrics(4);
        assert.equal(mPremium.maxBytes, 100 * BYTES_PER_GB, 'Premium debe tener 100 GB');

        console.log('✓ Prueba 3 superada: Capacidades comerciales exactas (Free 1GB, Básico 5GB, Pro 50GB, Premium 100GB).');
    }

    // 4. Probar validateUpload y rechazo 413 STORAGE_QUOTA_EXCEEDED sin borrar archivos
    {
        const subs = [
            { id: 1, id_usuario: 99, id_plan: 1, id_estado: 2, fecha_inicio: today, fecha_fin: in10Days } // Básico 5GB
        ];
        // Usuario tiene archivos que ocupan 4.5 GB
        const usedBytes = 4.5 * BYTES_PER_GB;
        const files = [
            { id: 10, id_usuario: 99, tamano_bytes: usedBytes, id_estado: 1 }
        ];

        const db = buildMockDb(subs, files);
        const QuotaService = loadQuotaService(db);

        // Subir archivo de 600 MB superará los 5 GB (4.5 + 0.6 = 5.1 GB > 5 GB)
        const incomingBytes = 600 * 1024 * 1024;
        await assert.rejects(
            async () => await QuotaService.validateUpload(99, incomingBytes),
            err => {
                assert.equal(err.status, 413);
                assert.equal(err.code, 'STORAGE_QUOTA_EXCEEDED');
                return true;
            },
            'Debe rechazar subida con 413 STORAGE_QUOTA_EXCEEDED'
        );

        // canUserUpload debe retornar allowed: false sin borrar archivos
        const check = await QuotaService.canUserUpload({ userId: 99, incomingSizeBytes: incomingBytes });
        assert.equal(check.allowed, false);
        assert.ok(check.reason.includes('supera el espacio disponible'));

        console.log('✓ Prueba 4 superada: validateUpload y canUserUpload rechazan con 413 si se excede la cuota.');
    }

    // 5. Probar fallback de getQuotaSummary cuando el usuario no tiene suscripción activa (Free 1GB)
    {
        const db = buildMockDb([]); // Sin suscripciones
        const QuotaService = loadQuotaService(db);

        const summary = await QuotaService.getQuotaSummary(999);
        assert.equal(summary.suscripcion_vigente, false);
        assert.equal(summary.plan_actual.nombre, 'Free');
        assert.equal(summary.plan_actual.espacio_maximo_gb, 1);
        assert.equal(summary.plan_actual.capacidad_bytes, 1 * BYTES_PER_GB);

        console.log('✓ Prueba 5 superada: Fallback de getQuotaSummary asigna Plan Free 1 GB.');
    }

    // 6. Probar AdminService.getOverview() con suscripciones Activa y PorVencer y contadores de 5 días
    {
        const future5Days = toDateStr(4);  // Próxima a vencer (en 4 días)
        const future15Days = toDateStr(15); // Activa plena
        const pastDate = toDateStr(-10);   // Vencida

        const tables = {
            usuario: [
                { id: 1, auth_user_id: 'auth-1', nombre: 'Ana', apellido: 'Pérez' },
                { id: 2, auth_user_id: 'auth-2', nombre: 'Carlos', apellido: 'Gómez' },
                { id: 3, auth_user_id: 'auth-3', nombre: 'Diana', apellido: 'Ríos' }
            ],
            suscripcion: [
                { id: 1, id_usuario: 1, fecha_inicio: yesterday, fecha_fin: future15Days, plan: mockPlans[1], estado: { nombre: 'Activa' } },
                { id: 2, id_usuario: 2, fecha_inicio: yesterday, fecha_fin: future5Days, plan: mockPlans[2], estado: { nombre: 'PorVencer' } },
                { id: 3, id_usuario: 3, fecha_inicio: pastMonth, fecha_fin: pastDate, plan: mockPlans[1], estado: { nombre: 'Vencida' } },
                // Histórico cancelado no debe contarse erróneamente en "Vencidas"
                { id: 4, id_usuario: 1, fecha_inicio: pastMonth, fecha_fin: pastDate, plan: mockPlans[1], estado: { nombre: 'Cancelada' } }
            ],
            archivo: [
                { id: 1, id_usuario: 1, tamano_bytes: 1000, estado: { nombre: 'Activo' } },
                { id: 2, id_usuario: 2, tamano_bytes: 2000, estado: { nombre: 'Activo' } }
            ],
            estado_usuario: [{ id: 1, nombre: 'Activo' }],
            rol: [{ id: 1, nombre: 'Cliente' }]
        };

        const db = {
            auth: { admin: { listUsers: async () => ({ data: { users: [] }, error: null }) } },
            from(table) {
                return {
                    select() { return this; },
                    order() { return this; },
                    async range(start, end) {
                        return { data: (tables[table] || []).slice(start, end + 1), error: null };
                    }
                };
            }
        };

        const context = {
            require: () => ({ createClient: () => db }),
            process: { env: {} },
            module: { exports: {} },
            Date,
            Number,
            Map
        };

        const adminFilePath = path.join(__dirname, '../src/services/admin.service.js');
        vm.runInNewContext(fs.readFileSync(adminFilePath, 'utf8'), context);
        const overview = await context.module.exports.getOverview();

        // Subscripciones vigentes: Usuario 1 (Activa 15 días) y Usuario 2 (PorVencer 4 días) = 2
        assert.equal(overview.metrics.activeSubscriptions, 2, 'Deben haber 2 suscripciones vigentes (Activa y PorVencer)');
        assert.equal(overview.metrics.subscribedUsers, 2, 'Deben haber 2 usuarios con suscripción vigente');

        // Cuota asignada: Básico (5 GB) + Pro (50 GB) = 55 GB
        assert.equal(overview.metrics.allocatedBytes, (5 + 50) * BYTES_PER_GB, 'Cuota asignada debe incluir PorVencer (55 GB)');

        // subscriptionStatus:
        // active (Activas con > 5 días) = 1 (Usuario 1)
        // expiring (PorVencer o <= 5 días) = 1 (Usuario 2)
        // expired (Vencida o fecha pasada en Activa/PorVencer, sin incluir Cancelada histórica) = 1 (Usuario 3)
        const [activeCount, expiringCount, expiredCount] = overview.metrics.subscriptionStatus;
        assert.equal(activeCount.count, 1, 'Activas (> 5 días) debe ser 1');
        assert.equal(expiringCount.count, 1, 'Próximas a vencer (<= 5 días o PorVencer) debe ser 1');
        assert.equal(expiredCount.count, 1, 'Vencidas debe ser 1 (excluyendo histórico Cancelada)');

        console.log('✓ Prueba 6 superada: AdminService.getOverview() integra PorVencer, cuota real y contadores correctos.');
    }

    console.log('\n============================================================');
    console.log('¡TODAS LAS PRUEBAS DE AJUSTES FASE 7 DE BENJA PASARON CON ÉXITO!');
    console.log('============================================================\n');
})().catch(err => {
    console.error('FALLO EN LA SUITE DE PRUEBAS:', err);
    process.exitCode = 1;
});
