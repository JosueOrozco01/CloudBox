const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BYTES_PER_GB = 1024 * 1024 * 1024;
const DEFAULT_FREE_QUOTA_GB = 1;
const DEFAULT_FREE_QUOTA_BYTES = DEFAULT_FREE_QUOTA_GB * BYTES_PER_GB;

function createServiceError(message, status, code) {
    const error = new Error(message);
    error.status = status;
    error.code = code;
    return error;
}

function normalizeDateStr(val) {
    if (!val) return null;
    if (val instanceof Date) return val.toISOString().split('T')[0];
    const str = String(val).trim();
    if (str.includes('T')) return str.split('T')[0];
    return str.substring(0, 10);
}

const QuotaService = {
    /**
     * Obtiene la suscripción comercial activa del usuario.
     * Reconoce estados 'Activa' y 'PorVencer' siempre que la fecha esté en período válido (fecha_inicio <= CURRENT_DATE <= fecha_fin).
     * El estado 'Pendiente' u otros no otorgan cuota comercial activa.
     */
    async getActiveSubscription(userId) {
        const { data: statusRows, error: statusError } =
            await supabaseAdmin
                .from('estado_suscripcion')
                .select('id, nombre')
                .in('nombre', ['Activa', 'PorVencer']);

        if (statusError) {
            throw new Error(
                `Error al obtener los estados de suscripción: ${statusError.message}`
            );
        }

        const validStatusIds = (statusRows || []).map(s => s.id);

        if (!validStatusIds.length) {
            const error = new Error(
                'No se encontraron los estados de suscripción Activa o PorVencer'
            );
            error.status = 500;
            throw error;
        }

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
                    plan:id_plan(
                        id,
                        nombre,
                        precio,
                        espacio_maximo_gb,
                        vigencia_dias,
                        id_estado
                    ),
                    estado:id_estado(
                        id,
                        nombre
                    )
                `)
                .eq('id_usuario', userId)
                .in('id_estado', validStatusIds)
                .order('fecha_inicio', { ascending: false });

        if (subscriptionError) {
            throw new Error(
                `Error al obtener la suscripción: ${subscriptionError.message}`
            );
        }

        const today = normalizeDateStr(new Date());

        const activeSub = (subscriptions || []).find(sub => {
            const startDate = normalizeDateStr(sub.fecha_inicio);
            const endDate = normalizeDateStr(sub.fecha_fin);

            if (startDate && startDate > today) {
                return false; // Período aún no inicia
            }
            if (endDate && endDate < today) {
                return false; // Período ya venció
            }
            return true;
        });

        if (!activeSub) {
            const error = new Error(
                'El usuario no tiene una suscripción activa'
            );
            error.status = 403;
            error.code = 'NO_ACTIVE_SUBSCRIPTION';
            throw error;
        }

        return activeSub;
    },

    /**
     * Retorna el plan gratuito base como fallback ante ausencia de suscripción comercial activa.
     */
    async getDefaultFreePlan() {
        try {
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
                .eq('id_estado', 1)
                .order('espacio_maximo_gb', { ascending: true })
                .limit(1)
                .maybeSingle();

            if (!error && data) {
                return {
                    ...data,
                    espacio_maximo_gb: Number(data.espacio_maximo_gb || DEFAULT_FREE_QUOTA_GB)
                };
            }
        } catch {
            // Degrada a objeto en memoria si la BD no responde
        }

        return {
            id: 1,
            nombre: 'Plan Básico Gratuito',
            precio: 0,
            espacio_maximo_gb: DEFAULT_FREE_QUOTA_GB,
            vigencia_dias: null,
            id_estado: 1
        };
    },

    async getPlan(planId) {
        if (!planId) return await this.getDefaultFreePlan();

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
                .select('id, nombre')
                .in('nombre', ['Activo', 'En papelera']);

        if (statesError) {
            throw new Error(
                `Error al obtener los estados de archivo: ${statesError.message}`
            );
        }

        const countedStateIds = (fileStates && fileStates.length > 0)
            ? fileStates.map(state => state.id)
            : [1, 2];

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

        return (files || []).reduce(
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
            throw new Error(
                `Error al actualizar el espacio utilizado: ${error.message}`
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
        let subscription = null;
        let plan = null;

        try {
            subscription = await this.getActiveSubscription(userId);
            plan = subscription.plan && subscription.plan.espacio_maximo_gb
                ? subscription.plan
                : await this.getPlan(subscription.id_plan);
        } catch (subErr) {
            if (subErr.code === 'NO_ACTIVE_SUBSCRIPTION') {
                plan = await this.getDefaultFreePlan();
                subscription = null;
            } else {
                throw subErr;
            }
        }

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
            subscription: subscription ? { fecha_fin: subscription.fecha_fin, estado: subscription.estado?.nombre || 'Activa' } : null,
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

    /**
     * Contrato canUserUpload:
     * Verifica si el usuario cuenta con cuota suficiente para la carga entrante.
     * Si el usuario se encuentra sobre cuota (por downgrade o cancelación), bloquea nuevas cargas,
     * pero NUNCA elimina archivos existentes ni altera registros físicos.
     */
    async canUserUpload(arg1, arg2) {
        let userId;
        let incomingSizeBytes;

        if (arg1 && typeof arg1 === 'object') {
            userId = arg1.userId || arg1.id_usuario;
            incomingSizeBytes = arg1.incomingSizeBytes ?? arg1.fileSize ?? arg1.size ?? 0;
        } else {
            userId = arg1;
            incomingSizeBytes = arg2 ?? 0;
        }

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

        const metrics = await this.getStorageMetrics(userId);

        if (metrics.usedBytes + size > metrics.maxBytes) {
            return {
                allowed: false,
                currentUsedBytes: metrics.usedBytes,
                maxBytes: metrics.maxBytes,
                availableBytes: metrics.availableBytes,
                reason: 'El archivo supera el espacio disponible de tu plan'
            };
        }

        return {
            allowed: true,
            currentUsedBytes: metrics.usedBytes,
            maxBytes: metrics.maxBytes,
            availableBytes: metrics.availableBytes
        };
    },

    async validateUpload(userId, fileSize) {
        const check = await this.canUserUpload(userId, fileSize);

        if (!check.allowed) {
            const error = new Error(
                check.reason || 'El archivo supera el espacio disponible de tu plan'
            );
            error.status = 413;
            error.code = 'STORAGE_QUOTA_EXCEEDED';
            throw error;
        }

        return await this.getStorageMetrics(userId);
    },

    async getQuotaSummary(userId) {
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
            suscripcion_vigente: !!metrics.subscription
        };
    },

    async releaseStorageQuota({ userId, freedBytes } = {}) {
        const bytesToFree = Number(freedBytes);
        if (isNaN(bytesToFree) || bytesToFree <= 0) {
            throw createServiceError('Cantidad de bytes a liberar inválida', 400, 'INVALID_FREED_BYTES');
        }

        const updatedUsedBytes = await this.syncUsedStorage(userId);

        return {
            success: true,
            updatedUsedBytes
        };
    }
};

module.exports = QuotaService;

