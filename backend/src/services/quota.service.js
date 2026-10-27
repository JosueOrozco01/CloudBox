const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BYTES_PER_GB = 1024 * 1024 * 1024;
const DEFAULT_FREE_QUOTA_BYTES = 1 * BYTES_PER_GB; // Free comercial = 1 GB

function createServiceError(message, status, code) {
    const error = new Error(message);
    error.status = status;
    error.code = code;
    return error;
}

function getCalendarDateString(date = new Date()) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseCalendarDate(dateVal) {
    if (!dateVal) return null;
    return String(dateVal).substring(0, 10);
}

const QuotaService = {
    /**
     * Obtiene la única suscripción vigente del usuario (Activa o PorVencer con fecha_fin >= CURRENT_DATE).
     * Sigue la convención inclusiva acordada para Fase 7 con normalización de fecha calendario.
     */
    async getActiveSubscription(userId) {
        const { data: activeStatuses, error: statusError } =
            await supabaseAdmin
                .from('estado_suscripcion')
                .select('id, nombre')
                .in('nombre', ['Activa', 'PorVencer']);

        if (statusError) {
            throw createServiceError(
                `Error al obtener estados de suscripción: ${statusError.message}`,
                500,
                'DATABASE_ERROR'
            );
        }

        if (!activeStatuses || activeStatuses.length === 0) {
            throw createServiceError(
                'No se encontraron los estados de suscripción Activa ni PorVencer en el catálogo',
                500,
                'STATUS_CATALOG_ERROR'
            );
        }

        const validStatusIds = activeStatuses.map(s => s.id);

        const { data: subscriptions, error: subscriptionError } =
            await supabaseAdmin
                .from('suscripcion')
                .select(`
                    id,
                    fecha_inicio,
                    fecha_fin,
                    id_usuario,
                    id_plan,
                    id_estado,
                    estado:id_estado (
                        id,
                        nombre
                    )
                `)
                .eq('id_usuario', userId)
                .in('id_estado', validStatusIds)
                .order('fecha_inicio', { ascending: false });

        if (subscriptionError) {
            throw createServiceError(
                `Error al obtener la suscripción: ${subscriptionError.message}`,
                500,
                'DATABASE_ERROR'
            );
        }

        // Convención Fase 7: fecha_fin >= CURRENT_DATE (límite inclusivo, normalizado a calendario)
        // Suscripciones sin fecha_fin (Free indefinido) se consideran vigentes.
        const todayStr = getCalendarDateString();
        const subscription = (subscriptions || []).find(sub => {
            if (!sub.fecha_fin) return true;
            const subDate = parseCalendarDate(sub.fecha_fin);
            return subDate >= todayStr;
        });

        if (!subscription) {
            const error = createServiceError(
                'El usuario no tiene una suscripción activa o vigente',
                403,
                'NO_ACTIVE_SUBSCRIPTION'
            );
            throw error;
        }

        return subscription;
    },

    async getPlan(planId) {
        const { data, error } = await supabaseAdmin
            .from('plan')
            .select(`
                id,
                nombre,
                precio,
                espacio_maximo_gb,
                vigencia_dias,
                id_estado
            `)
            .eq('id', planId)
            .single();

        if (error) {
            throw new Error(
                `Error al obtener el plan: ${error.message}`
            );
        }

        return data;
    },

    async calculateUsedStorage(userId) {
        const { data: fileStates, error: statesError } =
            await supabaseAdmin
                .from('estado_archivo')
                .select('id')
                .in('nombre', ['Activo', 'En papelera']);

        if (statesError) {
            throw new Error(
                `Error al obtener los estados de archivo: ${statesError.message}`
            );
        }

        const countedStateIds = fileStates.map(
            state => state.id
        );

        const { data: files, error } = await supabaseAdmin
            .from('archivo')
            .select('tamano_bytes')
            .eq('id_usuario', userId)
            .in('id_estado', countedStateIds);

        if (error) {
            throw new Error(
                `Error al calcular el espacio utilizado: ${error.message}`
            );
        }

        return files.reduce(
            (total, file) =>
                total + Number(file.tamano_bytes || 0),
            0
        );
    },

    async updateUsedStorage(userId, usedBytes) {
        let { error } = await supabaseAdmin
            .from('usuario')
            .update({
                espacio_usado_bytes: usedBytes
            })
            .eq('id', userId);

        if (error && (error.code === '42703' || (error.message && error.message.includes('column')))) {
            const retry = await supabaseAdmin
                .from('usuario')
                .update({
                    espacio_usado_by: usedBytes
                })
                .eq('id', userId);
            error = retry.error;
        }

        if (error) {
            throw createServiceError(
                `Error al actualizar el espacio utilizado: ${error.message}`,
                500,
                'DATABASE_ERROR'
            );
        }

        return usedBytes;
    },

    async syncUsedStorage(userId) {
        const usedBytes =
            await this.calculateUsedStorage(userId);

        await this.updateUsedStorage(
            userId,
            usedBytes
        );

        return usedBytes;
    },

    async getStorageMetrics(userId) {
        const subscription =
            await this.getActiveSubscription(userId);

        const plan =
            await this.getPlan(subscription.id_plan);

        const usedBytes =
            await this.syncUsedStorage(userId);

        const maxBytes =
            Number(plan.espacio_maximo_gb) *
            BYTES_PER_GB;

        const availableBytes =
            Math.max(maxBytes - usedBytes, 0);

        const percentageUsed =
            maxBytes > 0
                ? Number(
                    (
                        (usedBytes / maxBytes) *
                        100
                    ).toFixed(2)
                )
                : 0;

        return {
            subscription: {
                id: subscription.id,
                fecha_inicio: subscription.fecha_inicio,
                fecha_fin: subscription.fecha_fin,
                id_estado: subscription.id_estado,
                estado: subscription.estado?.nombre || 'Activa'
            },
            plan: {
                id: plan.id,
                nombre: plan.nombre,
                espacio_maximo_gb:
                    Number(plan.espacio_maximo_gb)
            },
            usedBytes,
            maxBytes,
            availableBytes,
            percentageUsed
        };
    },

    async validateUpload(userId, fileSize) {
        const metrics =
            await this.getStorageMetrics(userId);

        if (
            metrics.usedBytes + fileSize >
            metrics.maxBytes
        ) {
            const error = new Error(
                'El archivo supera el espacio disponible de tu plan'
            );

            error.status = 413;
            error.code = 'STORAGE_QUOTA_EXCEEDED';

            throw error;
        }

        return metrics;
    },

    // ========================================================
    // NUEVAS EXTENSIONES FASE 7 IMPLEMENTADAS POR BENJA
    // ========================================================

    /**
     * Resumen unificado de cuota para el endpoint GET /api/storage/quota-summary.
     */
    async getQuotaSummary(userId) {
        try {
            const metrics = await this.getStorageMetrics(userId);
            return {
                id_usuario: Number(userId),
                plan_actual: {
                    id: metrics.plan.id,
                    nombre: metrics.plan.nombre,
                    espacio_maximo_gb: metrics.plan.espacio_maximo_gb,
                    capacidad_bytes: metrics.maxBytes
                },
                espacio_usado_bytes: metrics.usedBytes,
                espacio_disponible_bytes: metrics.availableBytes,
                porcentaje_uso: metrics.percentageUsed,
                bloqueo_subida: metrics.availableBytes <= 0,
                suscripcion_vigente: true,
                estado_comercial: metrics.subscription?.estado || 'Activa',
                fecha_vencimiento: metrics.subscription?.fecha_fin || null
            };
        } catch (err) {
            // Fallback para usuarios sin suscripción activa: Plan Free Base (1 GB)
            if (err.code === 'NO_ACTIVE_SUBSCRIPTION') {
                const usedBytes = await this.syncUsedStorage(userId);
                const availableBytes = Math.max(DEFAULT_FREE_QUOTA_BYTES - usedBytes, 0);
                return {
                    id_usuario: Number(userId),
                    plan_actual: {
                        id: 8,
                        nombre: 'Free',
                        espacio_maximo_gb: 1,
                        capacidad_bytes: DEFAULT_FREE_QUOTA_BYTES
                    },
                    espacio_usado_bytes: usedBytes,
                    espacio_disponible_bytes: availableBytes,
                    porcentaje_uso: Number(((usedBytes / DEFAULT_FREE_QUOTA_BYTES) * 100).toFixed(2)),
                    bloqueo_subida: availableBytes <= 0,
                    suscripcion_vigente: false,
                    estado_comercial: 'Sin suscripción vigente',
                    fecha_vencimiento: null
                };
            }
            throw err;
        }
    },

    /**
     * Contrato 1: canUserUpload
     * Consumido por Jenni y FileStorage antes de permitir la subida de un archivo.
     *
     * @param {Object} params
     * @param {number|string} params.userId - Identificador numérico del usuario.
     * @param {number} params.incomingSizeBytes - Peso en bytes del archivo entrante.
     */
    async canUserUpload({ userId, incomingSizeBytes }) {
        const size = Number(incomingSizeBytes);
        if (isNaN(size) || size <= 0) {
            return {
                allowed: false,
                currentUsedBytes: 0,
                maxBytes: 0,
                availableBytes: 0,
                reason: 'El tamaño del archivo a subir es inválido o igual a cero'
            };
        }

        const summary = await this.getQuotaSummary(userId);

        if (summary.espacio_usado_bytes + size > summary.plan_actual.capacidad_bytes) {
            return {
                allowed: false,
                currentUsedBytes: summary.espacio_usado_bytes,
                maxBytes: summary.plan_actual.capacidad_bytes,
                availableBytes: summary.espacio_disponible_bytes,
                reason: 'El archivo supera el espacio disponible de tu plan'
            };
        }

        return {
            allowed: true,
            currentUsedBytes: summary.espacio_usado_bytes,
            maxBytes: summary.plan_actual.capacidad_bytes,
            availableBytes: summary.espacio_disponible_bytes
        };
    },

    /**
     * Contrato 2: releaseStorageQuota
     * Consumido por Jenni y FileStorage al eliminar archivos o vaciar papelera.
     *
     * @param {Object} params
     * @param {number|string} params.userId - Identificador numérico del usuario.
     * @param {number} params.freedBytes - Cantidad de bytes liberados.
     */
    async releaseStorageQuota({ userId, freedBytes }) {
        const bytesToFree = Number(freedBytes);
        if (isNaN(bytesToFree) || bytesToFree <= 0) {
            throw createServiceError('Cantidad de bytes a liberar inválida', 400, 'INVALID_FREED_BYTES');
        }

        // Sincroniza desde la base de datos para preservar consistencia ACID
        const updatedUsedBytes = await this.syncUsedStorage(userId);

        return {
            success: true,
            updatedUsedBytes
        };
    },

    /**
     * Actualiza el límite de almacenamiento tras un cambio de plan.
     */
    async updateUserPlanQuota(userId, newCapacityBytes) {
        const summary = await this.getQuotaSummary(userId);
        return {
            success: true,
            userId,
            newCapacityBytes,
            usedBytes: summary.espacio_usado_bytes,
            availableBytes: Math.max(newCapacityBytes - summary.espacio_usado_bytes, 0)
        };
    }
};

module.exports = QuotaService;
