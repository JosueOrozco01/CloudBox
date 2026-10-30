const { createClient } = require("@supabase/supabase-js");

const BYTES_PER_GB = 1024 * 1024 * 1024;

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

function createServiceError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

let recordLog = async () => {};
try {
  const auditMod = require("./audit.service");
  if (auditMod && typeof auditMod.recordLog === "function") {
    recordLog = auditMod.recordLog;
  }
} catch {
  // audit.service no disponible o en entorno de pruebas unitarias aisladas
}

let ActivityService = null;
try {
  ActivityService = require("./activity.service");
} catch {
  // activity.service no disponible o en entorno de pruebas unitarias aisladas
}

function getCalendarDateString(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseCalendarDate(dateVal) {
  if (!dateVal) return null;
  return String(dateVal).substring(0, 10);
}

async function readAll(table, columns) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select(columns)
      .order("id")
      .range(offset, offset + 999);
    if (error)
      throw new Error(`No se pudo consultar ${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

async function readAvatars() {
  const avatars = new Map();
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error)
      throw new Error("No se pudieron obtener las fotos de los usuarios.");
    for (const user of data.users) {
      const metadata = user.user_metadata || {};
      const url =
        metadata.avatar_url ||
        metadata.avatarUrl ||
        metadata.picture ||
        metadata.foto_url;
      if (typeof url === "string" && /^https?:\/\//i.test(url))
        avatars.set(user.id, url);
    }
    if (data.users.length < 1000) return avatars;
  }
}

const AdminService = {
  async getOverview() {
    const [users, subscriptions, files, states, roles, avatars] =
      await Promise.all([
        readAll(
          "usuario",
          "id,auth_user_id,nombre,apellido,correo,fecha_registro,id_rol,rol:id_rol(nombre),id_estado,estado_usuario:id_estado(nombre)",
        ),
        readAll(
          "suscripcion",
          "id,id_usuario,fecha_inicio,fecha_fin,plan:id_plan(id,nombre,espacio_maximo_gb),estado:id_estado(nombre)",
        ),
        readAll(
          "archivo",
          "id,id_usuario,tamano_bytes,fecha_subida,estado:id_estado(nombre)",
        ),
        readAll("estado_usuario", "id,nombre"),
        readAll("rol", "id,nombre"),
        readAvatars(),
      ]);
    const todayStr = getCalendarDateString();
    const fiveDaysDate = new Date();
    fiveDaysDate.setDate(fiveDaysDate.getDate() + 5);
    const fiveDaysStr = getCalendarDateString(fiveDaysDate);

    // Suscripciones vigentes: Activa o PorVencer con fecha_fin >= CURRENT_DATE (límite inclusivo normalizado)
    const active = subscriptions.filter((sub) => {
      const stateName = sub.estado?.nombre;
      if (stateName !== "Activa" && stateName !== "PorVencer") {
        return false;
      }
      if (!sub.fecha_fin) {
        return true;
      }
      const subDate = parseCalendarDate(sub.fecha_fin);
      return subDate >= todayStr;
    });
    const stored = files.filter((file) =>
      ["Activo", "En papelera"].includes(file.estado?.nombre),
    );

    return {
      users: users.map((user) => {
        const subscription = active
          .filter((sub) => sub.id_usuario === user.id)
          .sort(
            (a, b) => new Date(b.fecha_inicio) - new Date(a.fecha_inicio),
          )[0];
        return {
          ...user,
          avatarUrl: avatars.get(user.auth_user_id) || null,
          plan: subscription?.plan?.nombre || "Sin suscripción activa",
          maxBytes: subscription
            ? Number(subscription.plan?.espacio_maximo_gb || 0) * 1024 ** 3
            : null,
          usedBytes: stored
            .filter((file) => file.id_usuario === user.id)
            .reduce((sum, file) => sum + Number(file.tamano_bytes || 0), 0),
        };
      }),
      states,
      roles,
      metrics: {
        activeSubscriptions: active.length,
        subscribedUsers: new Set(
          active
            .map((sub) => sub.id_usuario)
            .filter((id) => users.some((user) => user.id === id)),
        ).size,
        usedBytes: stored.reduce(
          (sum, file) => sum + Number(file.tamano_bytes || 0),
          0,
        ),
        allocatedBytes: active.reduce(
          (sum, sub) =>
            sum + Number(sub.plan?.espacio_maximo_gb || 0) * 1024 ** 3,
          0,
        ),
        fileCount: stored.length,
        monthlyFiles: stored.filter(
          (file) =>
            new Date(file.fecha_subida) >=
            new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        ).length,
        planDistribution: [
          ...new Map(active.map((sub) => [sub.plan?.id, sub.plan])).values(),
        ]
          .filter(Boolean)
          .map((plan) => ({
            id: plan.id,
            label: plan.nombre,
            count: active.filter((sub) => sub.plan?.id === plan.id).length,
          })),
        subscriptionStatus: [
          {
            id: "active",
            label: "Activas",
            count: active.filter(
              (sub) =>
                sub.estado?.nombre === "Activa" &&
                (!sub.fecha_fin || parseCalendarDate(sub.fecha_fin) > fiveDaysStr),
            ).length,
            color: "#16a34a",
          },
          {
            id: "expiring",
            label: "Próximas a vencer (5 días)",
            count: active.filter(
              (sub) =>
                sub.estado?.nombre === "PorVencer" ||
                (sub.fecha_fin && parseCalendarDate(sub.fecha_fin) <= fiveDaysStr),
            ).length,
            color: "#f59e0b",
          },
          {
            id: "expired",
            label: "Vencidas",
            count: subscriptions.filter(
              (sub) =>
                sub.estado?.nombre === "Vencida" ||
                (["Activa", "PorVencer"].includes(sub.estado?.nombre) &&
                  sub.fecha_fin &&
                  parseCalendarDate(sub.fecha_fin) < todayStr),
            ).length,
            color: "#dc2626",
          },
        ],
      },
    };
  },

  async getAllUsers() {
    return (await this.getOverview()).users;
  },

  /**
   * Módulo ADM: Listado paginado de usuarios con soporte de búsqueda textual q y filtro por status.
   */
  async getUsersList({ q, search, status, limit = 20, offset = 0, page } = {}) {
    const p = Math.max(Number(page) || 0, 0);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const parsedOffset = p > 0 ? (p - 1) * parsedLimit : Math.max(0, parseInt(offset, 10) || 0);

    let statusId = null;
    if (status !== undefined && status !== null && String(status).trim() !== "") {
      const statusNum = Number(status);
      if (Number.isSafeInteger(statusNum) && statusNum > 0) {
        statusId = statusNum;
      } else {
        const { data: estadoEntry, error: estadoError } = await supabaseAdmin
          .from("estado_usuario")
          .select("id")
          .ilike("nombre", String(status).trim())
          .maybeSingle();

        if (estadoError) {
          throw createServiceError(`Error al consultar estado de usuario: ${estadoError.message}`, 500, "DATABASE_ERROR");
        }

        if (estadoEntry) {
          statusId = estadoEntry.id;
        } else {
          return {
            users: [],
            pagination: {
              limit: parsedLimit,
              offset: parsedOffset,
              total: 0,
              currentPage: p > 0 ? p : 1,
              pageSize: parsedLimit,
              totalRecords: 0,
              totalPages: 0,
            },
          };
        }
      }
    }

    const buildQuery = (storageCol) => {
      let query = supabaseAdmin
        .from("usuario")
        .select(`
          id,
          auth_user_id,
          nombre,
          apellido,
          correo,
          fecha_registro,
          id_rol,
          rol:id_rol(id, nombre),
          id_estado,
          estado:id_estado(id, nombre),
          ${storageCol}
        `, { count: "exact" });

      const searchTerm = q || search;
      if (searchTerm && typeof searchTerm === "string" && searchTerm.trim() !== "") {
        const term = searchTerm.trim();
        query = query.or(`nombre.ilike.%${term}%,apellido.ilike.%${term}%,correo.ilike.%${term}%`);
      }

      if (statusId) {
        query = query.eq("id_estado", statusId);
      }

      return query
        .order("fecha_registro", { ascending: false })
        .order("id", { ascending: false })
        .range(parsedOffset, parsedOffset + parsedLimit - 1);
    };

    let { data, error, count } = await buildQuery("espacio_usado_by");

    if (error && (error.code === "42703" || (error.message && error.message.includes("column")))) {
      const retry = await buildQuery("espacio_usado_bytes");
      data = retry.data;
      count = retry.count;
      error = retry.error;
    }

    if (error) {
      throw createServiceError(`Error al listar usuarios: ${error.message}`, 500, "DATABASE_ERROR");
    }

    const users = (data || []).map((u) => ({
      id: u.id,
      auth_user_id: u.auth_user_id,
      nombre: u.nombre,
      apellido: u.apellido,
      correo: u.correo,
      id_rol: u.id_rol,
      rol: u.rol?.nombre || "Cliente",
      id_estado: u.id_estado,
      estado: u.estado?.nombre || "Activo",
      estado_usuario: u.estado || { id: u.id_estado, nombre: u.estado?.nombre || "Activo" },
      espacio_usado_bytes: Number(u.espacio_usado_bytes || u.espacio_usado_by || 0),
      fecha_registro: u.fecha_registro,
    }));

    return {
      users,
      pagination: {
        limit: parsedLimit,
        offset: parsedOffset,
        total: count || 0,
        currentPage: p > 0 ? p : Math.floor(parsedOffset / parsedLimit) + 1,
        pageSize: parsedLimit,
        totalRecords: count || 0,
        totalPages: Math.ceil((count || 0) / parsedLimit),
      },
    };
  },

  /**
   * Módulo ADM: Obtiene el detalle individual de un usuario por ID con su rol, estado y cuota actual.
   */
  async getUserById(targetUserId) {
    const userId = Number(targetUserId);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw createServiceError("El identificador solicitado no es válido.", 400, "INVALID_USER_ID");
    }

    const buildQuery = (storageCol) =>
      supabaseAdmin
        .from("usuario")
        .select(`
          id,
          auth_user_id,
          nombre,
          apellido,
          correo,
          fecha_registro,
          id_rol,
          rol:id_rol(id, nombre),
          id_estado,
          estado:id_estado(id, nombre),
          ${storageCol}
        `)
        .eq("id", userId)
        .maybeSingle();

    let { data: user, error } = await buildQuery("espacio_usado_by");

    if (error && (error.code === "42703" || (error.message && error.message.includes("column")))) {
      const retry = await buildQuery("espacio_usado_bytes");
      user = retry.data;
      error = retry.error;
    }

    if (error) {
      throw createServiceError(`Error al consultar usuario: ${error.message}`, 500, "DATABASE_ERROR");
    }

    if (!user) {
      throw createServiceError("Usuario no encontrado.", 404, "USER_NOT_FOUND");
    }

    let subscription = null;
    let maxBytes = null;
    let plan = "Sin suscripción activa";

    try {
      const { data: subData } = await supabaseAdmin
        .from("suscripcion")
        .select(`
          id,
          fecha_inicio,
          fecha_fin,
          id_estado,
          estado:id_estado(id, nombre),
          plan:id_plan(id, nombre, espacio_maximo_gb)
        `)
        .eq("id_usuario", userId)
        .order("fecha_inicio", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subData) {
        subscription = subData;
        if (subData.plan?.espacio_maximo_gb) {
          maxBytes = Number(subData.plan.espacio_maximo_gb) * 1024 ** 3;
          plan = subData.plan.nombre || plan;
        }
      }
    } catch {
      // Degrada elegantemente si la tabla suscripcion no está disponible
    }

    const usedBytes = Number(user.espacio_usado_bytes || user.espacio_usado_by || 0);

    return {
      id: user.id,
      auth_user_id: user.auth_user_id,
      nombre: user.nombre,
      apellido: user.apellido,
      correo: user.correo,
      fecha_registro: user.fecha_registro,
      id_rol: user.id_rol,
      rol: user.rol?.nombre || "Cliente",
      id_estado: user.id_estado,
      estado: user.estado?.nombre || "Activo",
      estado_usuario: user.estado || { id: user.id_estado, nombre: user.estado?.nombre || "Activo" },
      espacio_usado_bytes: usedBytes,
      usedBytes,
      maxBytes,
      plan,
      suscripcion: subscription,
    };
  },

  /**
   * Módulo ADM: Actualiza el estado de un usuario con validaciones de seguridad y auditoría AUD-01.
   */
  async updateUserStatus(targetUserId, newStatusId, auditContext = {}) {
    const parsedTargetId = Number(targetUserId);
    const parsedStatusId = Number(newStatusId);

    if (
      !Number.isSafeInteger(parsedTargetId) ||
      parsedTargetId <= 0 ||
      !Number.isSafeInteger(parsedStatusId) ||
      parsedStatusId <= 0
    ) {
      throw createServiceError("El identificador solicitado no es válido.", 400, "INVALID_IDENTIFIER");
    }

    // Regla anti-autodesactivación
    if (auditContext.currentUserId && parsedTargetId === Number(auditContext.currentUserId)) {
      throw createServiceError("No puedes suspender tu propia cuenta", 400, "CANNOT_MODIFY_OWN_ACCOUNT");
    }

    // Verificar existencia del usuario objetivo y recuperar estado anterior
    const { data: targetUser, error: userError } = await supabaseAdmin
      .from("usuario")
      .select("id, id_estado, estado:id_estado(id, nombre)")
      .eq("id", parsedTargetId)
      .maybeSingle();

    if (userError) {
      throw createServiceError(`Error al consultar usuario: ${userError.message}`, 500, "DATABASE_ERROR");
    }
    if (!targetUser) {
      throw createServiceError("Usuario no encontrado.", 404, "USER_NOT_FOUND");
    }

    const prevStatus = targetUser.estado?.nombre || targetUser.id_estado;

    // Validar existencia del nuevo estado en catálogo
    const { data: catalogEntry, error: catalogError } = await supabaseAdmin
      .from("estado_usuario")
      .select("id, nombre")
      .eq("id", parsedStatusId)
      .maybeSingle();

    if (catalogError) {
      throw createServiceError(`Error al consultar catálogo: ${catalogError.message}`, 500, "DATABASE_ERROR");
    }
    if (!catalogEntry) {
      throw createServiceError("La opción seleccionada no existe en el catálogo.", 400, "INVALID_STATUS_CATALOG");
    }

    const newStatus = catalogEntry.nombre || catalogEntry.id;

    // Actualización atómica en la tabla usuario
    const { data, error } = await supabaseAdmin
      .from("usuario")
      .update({ id_estado: parsedStatusId })
      .eq("id", parsedTargetId)
      .select("id, nombre, id_estado")
      .single();

    if (error) {
      throw createServiceError(`Error al actualizar estado del usuario: ${error.message}`, 500, "DATABASE_ERROR");
    }

    // Invocar contrato congelado AUD-01 (atrapa internamente sus fallos para no revertir la operación)
    if (auditContext.currentUserId && typeof recordLog === "function") {
      try {
        await recordLog({
          id_usuario: auditContext.currentUserId,
          accion: "CAMBIO_ESTADO_USUARIO",
          entidad_afectada: "usuario",
          id_entidad_afectada: parsedTargetId,
          ip_origen: auditContext.ip_origen,
          detalles: {
            anterior: prevStatus,
            nuevo: newStatus,
            targetUserId: parsedTargetId,
            newStatusId: parsedStatusId,
          },
        });
      } catch (logErr) {
        console.error("Error al registrar auditoría CAMBIO_ESTADO_USUARIO:", logErr);
      }
    }

    // Registrar actividad del administrador actor (ADM-12) - aislado contra fallos secundarios
    if (auditContext.currentUserId && ActivityService && typeof ActivityService.recordActivity === "function") {
      try {
        await ActivityService.recordActivity({
          userId: auditContext.currentUserId,
          action: "Actualizar estado de usuario",
          description: `Cambio de estado del usuario ID ${parsedTargetId} (${prevStatus} -> ${newStatus})`,
        });
      } catch {
        // Fallos secundarios en actividad no revierten la operación principal
      }
    }

    return data;
  },

  /**
   * Módulo ADM: Actualiza el rol de un usuario con validaciones de seguridad y auditoría AUD-01.
   */
  async updateUserRole(targetUserId, newRoleId, auditContext = {}) {
    const parsedTargetId = Number(targetUserId);
    const parsedRoleId = Number(newRoleId);

    if (
      !Number.isSafeInteger(parsedTargetId) ||
      parsedTargetId <= 0 ||
      !Number.isSafeInteger(parsedRoleId) ||
      parsedRoleId <= 0
    ) {
      throw createServiceError("El identificador solicitado no es válido.", 400, "INVALID_IDENTIFIER");
    }

    // Regla anti-degradación de privilegios propios
    if (auditContext.currentUserId && parsedTargetId === Number(auditContext.currentUserId)) {
      throw createServiceError("No puedes degradar tus propios privilegios", 400, "CANNOT_MODIFY_OWN_ROLE");
    }

    // Verificar existencia del usuario objetivo y recuperar rol anterior
    const { data: targetUser, error: userError } = await supabaseAdmin
      .from("usuario")
      .select("id, id_rol, rol:id_rol(id, nombre)")
      .eq("id", parsedTargetId)
      .maybeSingle();

    if (userError) {
      throw createServiceError(`Error al consultar usuario: ${userError.message}`, 500, "DATABASE_ERROR");
    }
    if (!targetUser) {
      throw createServiceError("Usuario no encontrado.", 404, "USER_NOT_FOUND");
    }

    const prevRole = targetUser.rol?.nombre || targetUser.id_rol;

    // Validar existencia del nuevo rol en catálogo
    const { data: catalogEntry, error: catalogError } = await supabaseAdmin
      .from("rol")
      .select("id, nombre")
      .eq("id", parsedRoleId)
      .maybeSingle();

    if (catalogError) {
      throw createServiceError(`Error al consultar catálogo: ${catalogError.message}`, 500, "DATABASE_ERROR");
    }
    if (!catalogEntry) {
      throw createServiceError("La opción seleccionada no existe en el catálogo.", 400, "INVALID_ROLE_CATALOG");
    }

    const newRole = catalogEntry.nombre || catalogEntry.id;

    // Actualización atómica en la tabla usuario
    const { data, error } = await supabaseAdmin
      .from("usuario")
      .update({ id_rol: parsedRoleId })
      .eq("id", parsedTargetId)
      .select("id, nombre, id_rol")
      .single();

    if (error) {
      throw createServiceError(`Error al actualizar rol del usuario: ${error.message}`, 500, "DATABASE_ERROR");
    }

    // Invocar contrato congelado AUD-01
    if (auditContext.currentUserId && typeof recordLog === "function") {
      try {
        await recordLog({
          id_usuario: auditContext.currentUserId,
          accion: "CAMBIO_ROL_USUARIO",
          entidad_afectada: "usuario",
          id_entidad_afectada: parsedTargetId,
          ip_origen: auditContext.ip_origen,
          detalles: {
            anterior: prevRole,
            nuevo: newRole,
            targetUserId: parsedTargetId,
            newRoleId: parsedRoleId,
          },
        });
      } catch (logErr) {
        console.error("Error al registrar auditoría CAMBIO_ROL_USUARIO:", logErr);
      }
    }

    // Registrar actividad del administrador actor (ADM-12) - aislado contra fallos secundarios
    if (auditContext.currentUserId && ActivityService && typeof ActivityService.recordActivity === "function") {
      try {
        await ActivityService.recordActivity({
          userId: auditContext.currentUserId,
          action: "Actualizar rol de usuario",
          description: `Cambio de rol del usuario ID ${parsedTargetId} (${prevRole} -> ${newRole})`,
        });
      } catch {
        // Fallos secundarios en actividad no revierten la operación principal
      }
    }

    return data;
  },

  async getAuditLogs(limit = 20, offset = 0) {
    const { data, error, count } = await supabaseAdmin
      .from("LogAuditoria")
      .select("*", { count: "exact" })
      .order("fecha", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Error al obtener bitácora: ${error.message}`);
    }

    const ids = [
      ...new Set(
        data
          .flatMap((log) => [
            log.id_usuario,
            log.entidad_afectada === "usuario" ? log.id_entidad_afectada : null,
          ])
          .filter(Boolean),
      ),
    ];
    let names = new Map();
    if (ids.length) {
      const { data: users, error: usersError } = await supabaseAdmin
        .from("usuario")
        .select("id,nombre,apellido")
        .in("id", ids);
      if (usersError) throw usersError;
      names = new Map(
        users.map((user) => [
          user.id,
          [user.nombre, user.apellido].filter(Boolean).join(" "),
        ]),
      );
    }
    const [states, roles] = data.length
      ? await Promise.all([
          readAll("estado_usuario", "id,nombre"),
          readAll("rol", "id,nombre"),
        ])
      : [[], []];
    return {
      logs: data.map((log) => {
        let detail = log.detalle;
        try {
          if (typeof detail === "string") detail = JSON.parse(detail);
        } catch {
          detail = null;
        }
        const assignedStatus = states.find(
          (state) => state.id === Number(detail?.newStatusId),
        )?.nombre;
        const assignedRole = roles.find(
          (role) => role.id === Number(detail?.newRoleId),
        )?.nombre;
        return {
          ...log,
          actorName: names.get(log.id_usuario) || "Usuario no disponible",
          targetName: log.entidad_afectada === "usuario"
            ? names.get(log.id_entidad_afectada) || null
            : detail?.resourceName || null,
          resultDescription: assignedStatus
            ? `Estado asignado: ${assignedStatus}`
            : assignedRole
              ? `Rol asignado: ${assignedRole}`
              : detail?.description || null,
        };
      }),
      total: count,
    };
  },

  /**
   * Módulo STO: Estadísticas generales de almacenamiento y archivos.
   */
  async getStorageOverview() {
    const service = require("./admin-storage.service");
    return service.getStorageOverview();
  },

  /**
   * Módulo STO: Almacenamiento por usuario con paginación y filtro de sobre cuota.
   */
  async getStorageUsers(params) {
    const service = require("./admin-storage.service");
    return service.getStorageUsers(params);
  },

  /**
   * Módulo STO: Usuarios sobre cuota.
   */
  async getUsersOverQuota(params) {
    const service = require("./admin-storage.service");
    return service.getUsersOverQuota(params);
  },

  // ==========================================
  // EXTENSIONES FASE 7 - PANEL DE ADMINISTRACIÓN
  // ==========================================

  /**
   * Estadísticas de alto nivel: usuarios, suscripciones e ingresos globales.
   */
  async getGeneralStats() {
    const { count: totalUsuarios } = await supabaseAdmin
      .from('usuario')
      .select('*', { count: 'exact', head: true });

    const { count: usuariosActivos } = await supabaseAdmin
      .from('usuario')
      .select('*', { count: 'exact', head: true })
      .eq('id_estado', 1);

    const { data: activeStatusRows } = await supabaseAdmin
      .from('estado_suscripcion')
      .select('id, nombre')
      .in('nombre', ['Activa', 'PorVencer']);

    const activeStatusIds = (activeStatusRows || []).map(s => s.id);
    const todayStr = getCalendarDateString();

    const { data: subsVigentes } = await supabaseAdmin
      .from('suscripcion')
      .select('id, fecha_fin')
      .in('id_estado', activeStatusIds.length > 0 ? activeStatusIds : [2, 3]);

    const totalSuscripcionesActivas = (subsVigentes || []).filter(sub => {
      if (!sub.fecha_fin) return true;
      return parseCalendarDate(sub.fecha_fin) >= todayStr;
    }).length;

    const { data: pagos } = await supabaseAdmin
      .from('pago')
      .select('monto')
      .eq('id_estado', 1); // 1 = Aprobado

    const ingresosTotales = (pagos || []).reduce((acc, p) => acc + Number(p.monto || 0), 0);

    const { data: archivos } = await supabaseAdmin
      .from('archivo')
      .select('tamano_bytes')
      .neq('id_estado', 3);

    const almacenamientoUsadoBytes = (archivos || []).reduce((acc, a) => acc + Number(a.tamano_bytes || 0), 0);

    return {
      totalUsuarios: totalUsuarios || 0,
      usuariosActivos: usuariosActivos || 0,
      totalSuscripcionesActivas,
      ingresosTotales: Number(ingresosTotales.toFixed(2)),
      almacenamientoUsadoBytes,
      almacenamientoUsadoGb: Number((almacenamientoUsadoBytes / BYTES_PER_GB).toFixed(2))
    };
  },

  /**
   * Métricas agregadas de almacenamiento global consumido.
   */
  async getStorageMetrics() {
    const { data: archivos, error } = await supabaseAdmin
      .from('archivo')
      .select('id, nombre, tamano_bytes')
      .neq('id_estado', 3);

    if (error) {
      throw createServiceError(`Error en storage-metrics: ${error.message}`, 500, 'DATABASE_ERROR');
    }

    let espacioConsumidoTotalBytes = 0;
    const distribucionPorTipo = { pdf: 0, imagenes: 0, documentos: 0, otros: 0 };

    (archivos || []).forEach(file => {
      const bytes = Number(file.tamano_bytes || 0);
      espacioConsumidoTotalBytes += bytes;
      const ext = file.nombre ? file.nombre.split('.').pop().toLowerCase() : 'otros';

      if (ext === 'pdf') distribucionPorTipo.pdf += bytes;
      else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) distribucionPorTipo.imagenes += bytes;
      else if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'].includes(ext)) distribucionPorTipo.documentos += bytes;
      else distribucionPorTipo.otros += bytes;
    });

    return {
      espacioConsumidoTotalBytes,
      espacioConsumidoTotalGb: Number((espacioConsumidoTotalBytes / BYTES_PER_GB).toFixed(2)),
      totalArchivos: (archivos || []).length,
      distribucionPorTipo
    };
  },

  /**
   * Listado exhaustivo de suscripciones con filtros.
   */
  async getAllSubscriptions({ page = 1, limit = 20, status } = {}) {
    const p = Math.max(Number(page) || 1, 1);
    const l = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const from = (p - 1) * l;
    const to = from + l - 1;

    const { data: catalogStatuses } = await supabaseAdmin
      .from('estado_suscripcion')
      .select('id, nombre');

    const statusMap = new Map((catalogStatuses || []).map(s => [s.nombre.toLowerCase(), s.id]));

    const buildSubQuery = (dateCol) => {
      let q = supabaseAdmin
        .from('suscripcion')
        .select(`id, fecha_inicio, ${dateCol}, id_usuario, id_plan, id_estado, estado:id_estado(id, nombre)`, { count: 'exact' });

      if (status) {
        const statusLower = String(status).toLowerCase();
        const statusId = statusMap.get(statusLower) || Number(status);
        if (statusId) {
          q = q.eq('id_estado', statusId);
        }
      }

      return q.order('id', { ascending: false }).range(from, to);
    };

    let { data: subs, count, error } = await buildSubQuery('fecha_vencimiento');

    if (error && (error.code === '42703' || (error.message && error.message.includes('column')))) {
      const retry = await buildSubQuery('fecha_fin');
      subs = retry.data;
      count = retry.count;
      error = retry.error;
    }

    if (error) {
      throw createServiceError(`Error al listar suscripciones admin: ${error.message}`, 500, 'DATABASE_ERROR');
    }

    if (!subs || subs.length === 0) {
      return {
        subscriptions: [],
        pagination: {
          currentPage: 1,
          pageSize: l,
          totalRecords: 0,
          totalPages: 0
        }
      };
    }

    const userIds = [...new Set(subs.map(s => s.id_usuario).filter(Boolean))];
    const planIds = [...new Set(subs.map(s => s.id_plan).filter(Boolean))];

    const [usersRes, plansRes] = await Promise.all([
      userIds.length > 0
        ? supabaseAdmin.from('usuario').select('id, nombre, apellido, correo').in('id', userIds)
        : Promise.resolve({ data: [] }),
      planIds.length > 0
        ? supabaseAdmin.from('plan').select('id, nombre, precio, espacio_maximo_gb').in('id', planIds)
        : Promise.resolve({ data: [] })
    ]);

    const usersMap = new Map((usersRes.data || []).map(u => [u.id, u]));
    const plansMap = new Map((plansRes.data || []).map(p => [p.id, p]));

    const subscriptions = subs.map(s => ({
      id: s.id,
      usuario: usersMap.get(s.id_usuario) || null,
      plan: plansMap.get(s.id_plan) || null,
      estado: s.estado?.nombre || (s.id_estado === 2 ? 'Activa' : (s.id_estado === 3 ? 'PorVencer' : 'Inactiva')),
      fecha_inicio: s.fecha_inicio,
      fecha_vencimiento: s.fecha_vencimiento || s.fecha_fin || null
    }));

    return {
      subscriptions,
      pagination: {
        currentPage: p,
        pageSize: l,
        totalRecords: count || 0,
        totalPages: Math.ceil((count || 0) / l)
      }
    };
  },

  /**
   * Desglose financiero por rango de fechas.
   */
  async getRevenueReport({ startDate, endDate } = {}) {
    let query = supabaseAdmin
      .from('pago')
      .select(`
        id,
        monto,
        fecha_pago,
        id_estado,
        referencia,
        suscripcion (
          plan (id, nombre)
        )
      `)
      .eq('id_estado', 1); // 1 = Aprobado

    if (startDate) query = query.gte('fecha_pago', `${startDate}T00:00:00.000Z`);
    if (endDate) query = query.lte('fecha_pago', `${endDate}T23:59:59.999Z`);

    const { data: pagos, error } = await query.order('fecha_pago', { ascending: false });

    if (error) {
      throw createServiceError(`Error al calcular ingresos: ${error.message}`, 500, 'DATABASE_ERROR');
    }

    const totalRecaudado = (pagos || []).reduce((acc, p) => acc + Number(p.monto || 0), 0);

    return {
      periodo: {
        desde: startDate || 'Inicio',
        hasta: endDate || 'Hoy'
      },
      ingresosTotales: Number(totalRecaudado.toFixed(2)),
      totalTransacciones: (pagos || []).length,
      transacciones: pagos || []
    };
  }
};

module.exports = AdminService;
