
const {
  utcDay,
  isCurrent,
  readPages,
  freePlan,
} = require("./commercial-policy");

const { createClient } = require("@supabase/supabase-js");

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

const BYTES_PER_GB = 1024 * 1024 * 1024;
const DEFAULT_FREE_QUOTA_GB = 1;

function createServiceError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

const QuotaService = {
  /**
   * Obtiene la suscripción vigente del usuario.
   * Se consideran Activa y PorVencer.
   * La fecha de vencimiento es inclusiva.
   */
  async getActiveSubscription(userId) {
    const { data: activeStatuses, error: statusError } =
      await supabaseAdmin
        .from("estado_suscripcion")
        .select("id, nombre")
        .in("nombre", ["Activa", "PorVencer"]);

    if (statusError) {
      throw createServiceError(
        `Error al obtener estados de suscripción: ${statusError.message}`,
        500,
        "DATABASE_ERROR"
      );
    }

    if (!activeStatuses || activeStatuses.length === 0) {
      throw createServiceError(
        "No se encontraron los estados de suscripción Activa ni PorVencer en el catálogo",
        500,
        "STATUS_CATALOG_ERROR"
      );
    }

    const validStatusIds = activeStatuses.map(
      (status) => status.id
    );

    const { data: subscriptions, error: subscriptionError } =
      await supabaseAdmin
        .from("suscripcion")
        .select(`
          id,
          fecha_inicio,
          fecha_fin,
          id_usuario,
          id_plan,
          id_estado,
          plan:id_plan (
            id,
            nombre,
            precio,
            espacio_maximo_gb,
            vigencia_dias,
            id_estado
          ),
          estado:id_estado (
            id,
            nombre
          )
        `)
        .eq("id_usuario", userId)
        .in("id_estado", validStatusIds)
        .order("fecha_inicio", { ascending: false });

    if (subscriptionError) {
      throw createServiceError(
        `Error al obtener la suscripción: ${subscriptionError.message}`,
        500,
        "DATABASE_ERROR"
      );
    }

    const todayStr = utcDay();

    const valid = (subscriptions || []).filter((sub) =>
      isCurrent(sub, todayStr)
    );

    if (valid.length > 1) {
      throw createServiceError(
        "Varias suscripciones vigentes",
        409,
        "MULTIPLE_ACTIVE_SUBSCRIPTIONS"
      );
    }

    const activeSub = valid[0];

    if (!activeSub) {
      throw createServiceError(
        "El usuario no tiene una suscripción activa o vigente",
        403,
        "NO_ACTIVE_SUBSCRIPTION"
      );
    }

    return activeSub;
  },

  /**
   * Obtiene el plan gratuito.
   * Utiliza la política comercial centralizada.
   * Si no está disponible, conserva el fallback
   * de 1 GB utilizado en la rama feature.
   */
  async getDefaultFreePlan() {
    try {
      const plan = await freePlan(supabaseAdmin);

      if (plan) {
        return {
          ...plan,
          espacio_maximo_gb: Number(
            plan.espacio_maximo_gb ??
              DEFAULT_FREE_QUOTA_GB
          ),
        };
      }
    } catch {
      // Se intenta recuperar el plan desde la tabla.
    }

    try {
      const { data, error } = await supabaseAdmin
        .from("plan")
        .select(`
          id,
          nombre,
          precio,
          espacio_maximo_gb,
          vigencia_dias,
          id_estado
        `)
        .eq("id_estado", 1)
        .order("espacio_maximo_gb", {
          ascending: true,
        })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        return {
          ...data,
          espacio_maximo_gb: Number(
            data.espacio_maximo_gb ??
              DEFAULT_FREE_QUOTA_GB
          ),
        };
      }
    } catch {
      // Fallback en memoria si la consulta falla.
    }

    return {
      id: 1,
      nombre: "Plan Básico Gratuito",
      precio: 0,
      espacio_maximo_gb: DEFAULT_FREE_QUOTA_GB,
      vigencia_dias: null,
      id_estado: 1,
    };
  },

  /**
   * Obtiene un plan por su identificador.
   */
  async getPlan(planId) {
    if (!planId) {
      return this.getDefaultFreePlan();
    }

    const { data, error } = await supabaseAdmin
      .from("plan")
      .select(`
        id,
        nombre,
        precio,
        espacio_maximo_gb,
        vigencia_dias,
        id_estado
      `)
      .eq("id", planId)
      .single();

    if (error) {
      throw createServiceError(
        `Error al obtener el plan: ${error.message}`,
        500,
        "DATABASE_ERROR"
      );
    }

    return data;
  },

  /**
   * Calcula el almacenamiento utilizado.
   * Incluye archivos activos y en papelera.
   */
  async calculateUsedStorage(userId) {
    const { data: fileStates, error: statesError } =
      await supabaseAdmin
        .from("estado_archivo")
        .select("id, nombre")
        .in("nombre", ["Activo", "En papelera"]);

    if (statesError) {
      throw createServiceError(
        `Error al obtener los estados de archivo: ${statesError.message}`,
        500,
        "DATABASE_ERROR"
      );
    }

    const requiredStates = ["Activo", "En papelera"];

    if (
      !fileStates ||
      !requiredStates.every((name) =>
        fileStates.some((state) => state.nombre === name)
      )
    ) {
      throw createServiceError(
        "Catálogo de archivos incompleto",
        503,
        "FILE_STATES_UNAVAILABLE"
      );
    }

    const countedStateIds = fileStates.map(
      (state) => state.id
    );

    const files = await readPages(() =>
      supabaseAdmin
        .from("archivo")
        .select("id,tamano_bytes")
        .eq("id_usuario", userId)
        .in("id_estado", countedStateIds)
        .order("id")
    );

    const used = files.reduce(
      (total, file) =>
        total + Number(file.tamano_bytes || 0),
      0
    );

    if (!Number.isSafeInteger(used) || used < 0) {
      throw createServiceError(
        "Uso de almacenamiento inválido",
        503,
        "INVALID_STORAGE_TOTAL"
      );
    }

    return used;
  },

  /**
   * Actualiza el espacio utilizado por un usuario.
   * Conserva compatibilidad con ambos nombres
   * de columna encontrados en las ramas.
   */
  async updateUsedStorage(userId, usedBytes) {
    if (
      !Number.isSafeInteger(Number(usedBytes)) ||
      Number(usedBytes) < 0
    ) {
      throw createServiceError(
        "Cantidad de almacenamiento inválida",
        400,
        "INVALID_STORAGE_TOTAL"
      );
    }

    let { error } = await supabaseAdmin
      .from("usuario")
      .update({
        espacio_usado_by: usedBytes,
      })
      .eq("id", userId);

    if (
      error &&
      (
        error.code === "42703" ||
        error.code === "PGRST204" ||
        /column|schema cache/i.test(error.message || "")
      )
    ) {
      const retry = await supabaseAdmin
        .from("usuario")
        .update({
          espacio_usado_bytes: usedBytes,
        })
        .eq("id", userId);

      error = retry.error;
    }

    if (error) {
      throw createServiceError(
        `Error al actualizar el espacio utilizado: ${error.message}`,
        500,
        "DATABASE_ERROR"
      );
    }

    return usedBytes;
  },

  /**
   * Sincroniza el almacenamiento real con la BD.
   */
  async syncUsedStorage(userId) {
    const usedBytes =
      await this.calculateUsedStorage(userId);

    await this.updateUsedStorage(
      userId,
      usedBytes
    );

    return usedBytes;
  },

  /**
   * Obtiene las métricas de almacenamiento
   * y el plan comercial del usuario.
   */
  async getStorageMetrics(userId) {
    let subscription = null;
    let plan = null;

    try {
      subscription =
        await this.getActiveSubscription(userId);

      plan =
        subscription.plan &&
        subscription.plan.espacio_maximo_gb != null
          ? subscription.plan
          : await this.getPlan(subscription.id_plan);
    } catch (subErr) {
      if (subErr.code === "NO_ACTIVE_SUBSCRIPTION") {
        subscription = null;
        plan = await this.getDefaultFreePlan();
      } else {
        throw subErr;
      }
    }

    const hasSubscription = Boolean(subscription);

    const usedBytes =
      await this.syncUsedStorage(userId);

    const maxBytes =
      Number(plan.espacio_maximo_gb) *
      BYTES_PER_GB;

    if (
      !Number.isSafeInteger(maxBytes) ||
      maxBytes < 0
    ) {
      throw createServiceError(
        "Capacidad del plan inválida",
        503,
        "INVALID_PLAN_CAPACITY"
      );
    }

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
      hasSubscription,

      subscription: subscription
        ? {
            id: subscription.id,
            fecha_inicio: subscription.fecha_inicio,
            fecha_fin: subscription.fecha_fin,
            id_estado: subscription.id_estado,
            estado:
              subscription.estado?.nombre ||
              "Activa",
          }
        : null,

      plan: {
        id: plan.id,
        nombre: plan.nombre,
        espacio_maximo_gb:
          Number(plan.espacio_maximo_gb),
      },

      usedBytes,
      maxBytes,
      availableBytes,
      percentageUsed,
    };
  },

  /**
   * Contrato canUserUpload.
   *
   * Acepta:
   * canUserUpload(userId, size)
   *
   * O:
   * canUserUpload({
   *   userId,
   *   incomingSizeBytes
   * })
   *
   * Nunca elimina archivos por exceso de cuota.
   */
  async canUserUpload(arg1, arg2) {
    let userId;
    let incomingSizeBytes;

    if (
      arg1 &&
      typeof arg1 === "object"
    ) {
      userId =
        arg1.userId ||
        arg1.id_usuario;

      incomingSizeBytes =
        arg1.incomingSizeBytes ??
        arg1.fileSize ??
        arg1.size ??
        0;
    } else {
      userId = arg1;
      incomingSizeBytes = arg2 ?? 0;
    }

    const size = Number(incomingSizeBytes);

    if (
      !Number.isSafeInteger(size) ||
      size <= 0
    ) {
      return {
        allowed: false,
        currentUsedBytes: 0,
        maxBytes: 0,
        availableBytes: 0,
        reason:
          "El tamaño del archivo a subir es inválido o igual a cero",
      };
    }

    const metrics =
      await this.getStorageMetrics(userId);

    if (
      metrics.usedBytes + size >
      metrics.maxBytes
    ) {
      return {
        allowed: false,
        currentUsedBytes:
          metrics.usedBytes,
        maxBytes:
          metrics.maxBytes,
        availableBytes:
          metrics.availableBytes,
        reason:
          "El archivo supera el espacio disponible de tu plan",
      };
    }

    return {
      allowed: true,
      currentUsedBytes:
        metrics.usedBytes,
      maxBytes:
        metrics.maxBytes,
      availableBytes:
        metrics.availableBytes,
    };
  },

  /**
   * Valida si un archivo puede subirse.
   * Lanza error 413 si supera la cuota.
   */
  async validateUpload(userId, fileSize) {
    const size = Number(fileSize);

    if (
      !Number.isSafeInteger(size) ||
      size <= 0
    ) {
      throw createServiceError(
        "Tamaño inválido",
        400,
        "INVALID_FILE_SIZE"
      );
    }

    const check =
      await this.canUserUpload(userId, size);

    if (!check.allowed) {
      throw createServiceError(
        check.reason ||
          "El archivo supera el espacio disponible de tu plan",
        413,
        "STORAGE_QUOTA_EXCEEDED"
      );
    }

    return this.getStorageMetrics(userId);
  },

  /**
   * Resumen unificado de cuota.
   *
   * Endpoint:
   * GET /api/storage/quota-summary
   */
  async getQuotaSummary(userId) {
    const metrics =
      await this.getStorageMetrics(userId);

    return {
      id_usuario: Number(userId),

      plan_actual: {
        id: metrics.plan.id,
        nombre: metrics.plan.nombre,
        espacio_maximo_gb:
          metrics.plan.espacio_maximo_gb,
        capacidad_bytes:
          metrics.maxBytes,
      },

      espacio_usado_bytes:
        metrics.usedBytes,

      espacio_disponible_bytes:
        metrics.availableBytes,

      porcentaje_uso:
        metrics.percentageUsed,

      bloqueo_subida:
        metrics.availableBytes <= 0,

      suscripcion_vigente:
        metrics.hasSubscription,

      estado_comercial:
        metrics.subscription?.estado ||
        "Sin suscripción vigente",

      fecha_vencimiento:
        metrics.subscription?.fecha_fin ||
        null,
    };
  },

  /**
   * Contrato releaseStorageQuota.
   *
   * Utilizado cuando se eliminan archivos
   * o se vacía la papelera.
   *
   * La cuota se recalcula desde la BD
   * para evitar descontar dos veces.
   */
  async releaseStorageQuota(arg1, arg2) {
    let userId;
    let freedBytes;

    if (
      arg1 &&
      typeof arg1 === "object"
    ) {
      userId =
        arg1.userId ||
        arg1.id_usuario;

      freedBytes =
        arg1.freedBytes ??
        arg1.size ??
        0;
    } else {
      userId = arg1;
      freedBytes = arg2 ?? 0;
    }

    const bytesToFree = Number(freedBytes);

    if (
      !Number.isSafeInteger(bytesToFree) ||
      bytesToFree <= 0
    ) {
      throw createServiceError(
        "Cantidad de bytes a liberar inválida",
        400,
        "INVALID_FREED_BYTES"
      );
    }

    // Recalcula desde los archivos existentes.
    // No resta manualmente los bytes.
    const updatedUsedBytes =
      await this.syncUsedStorage(userId);

    return {
      success: true,
      updatedUsedBytes,
    };
  },

  /**
   * Actualiza la información de cuota
   * después de un cambio de plan.
   *
   * No elimina archivos existentes.
   */
  async updateUserPlanQuota(
    userId,
    newCapacityBytes
  ) {
    const capacity = Number(newCapacityBytes);

    if (
      !Number.isSafeInteger(capacity) ||
      capacity < 0
    ) {
      throw createServiceError(
        "Capacidad del plan inválida",
        400,
        "INVALID_PLAN_CAPACITY"
      );
    }

    const summary =
      await this.getQuotaSummary(userId);

    return {
      success: true,
      userId,
      newCapacityBytes: capacity,
      usedBytes:
        summary.espacio_usado_bytes,
      availableBytes: Math.max(
        capacity -
          summary.espacio_usado_bytes,
        0
      ),
    };
  },
};

module.exports = QuotaService;
