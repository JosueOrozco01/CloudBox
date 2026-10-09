const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BYTES_PER_GB = 1024 * 1024 * 1024;

const QuotaService = {
    async getActiveSubscription(userId) {
        const { data: activeStatus, error: statusError } =
            await supabaseAdmin
                .from('estado_suscripcion')
                .select('id')
                .eq('nombre', 'Activa')
                .maybeSingle();

        if (statusError) {
            throw new Error(
                `Error al obtener el estado de suscripción: ${statusError.message}`
            );
        }

        if (!activeStatus) {
            const error = new Error(
                'No se encontró el estado de suscripción Activa'
            );
            error.status = 500;
            throw error;
        }

        const { data: subscription, error: subscriptionError } =
            await supabaseAdmin
                .from('suscripcion')
                .select(`
                    id,
                    fecha_inicio,
                    fecha_fin,
                    id_usuario,
                    id_plan,
                    id_estado
                `)
                .eq('id_usuario', userId)
                .eq('id_estado', activeStatus.id)
                .order('fecha_inicio', { ascending: false })
                .limit(1)
                .maybeSingle();

        if (subscriptionError) {
            throw new Error(
                `Error al obtener la suscripción: ${subscriptionError.message}`
            );
        }

        if (!subscription) {
            const error = new Error(
                'El usuario no tiene una suscripción activa'
            );
            error.status = 403;
            error.code = 'NO_ACTIVE_SUBSCRIPTION';
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
        const { error } = await supabaseAdmin
            .from('usuario')
            .update({
                espacio_usado_by: usedBytes
            })
            .eq('id', userId);

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
            subscription: { fecha_fin: subscription.fecha_fin },
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
    }
};

module.exports = QuotaService;
