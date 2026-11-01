
const {utcDay,isCurrent,readPages,calendarDate} = require('./commercial-policy');
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

const getCalendarDateString = utcDay;
const parseCalendarDate = value => value ? String(value).slice(0,10) : null;

async function readAll(table, columns, filter = q => q) {
  return readPages(() => filter(supabaseAdmin.from(table).select(columns)).order('id'));
}

function pagination(page, limit) {
  const p=Number(page),requested=Number(limit),l=Math.min(requested,100);
  if (!Number.isSafeInteger(p)||p<1||!Number.isSafeInteger(requested)||l<1) throw createServiceError('Paginación inválida',400,'INVALID_PAGINATION');
  return {p,l,from:(p-1)*l,to:p*l-1};
}

function totalMoney(rows) {
  const cents=rows.reduce((sum,row)=>sum+Math.round(Number(row.monto)*100),0);
  if (!Number.isSafeInteger(cents)) throw createServiceError('Total monetario inválido',500,'INVALID_REPORT_TOTAL');
  return cents/100;
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
      if (metadata.avatar_path) {
        const signed=await supabaseAdmin.storage.from('avatars').createSignedUrl(metadata.avatar_path,3600);
        if (signed.data?.signedUrl) avatars.set(user.id,signed.data.signedUrl);
      }
      if (!avatars.has(user.id) && typeof url === "string" && /^https?:\/\//i.test(url))
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
      return isCurrent(sub,todayStr);
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
            new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)),
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
  async getUsersList({ q, search, status, plan, days, sort = 'recent', limit = 20, offset = 0, page } = {}) {
    if (days && !['7','30'].includes(String(days))) throw createServiceError('Fecha inválida',400,'INVALID_FILTER');
    if (!['recent','name','storage'].includes(sort)) throw createServiceError('Orden inválido',400,'INVALID_FILTER');
    const subscriptions = await readAll('suscripcion','id,id_usuario,fecha_inicio,fecha_fin,plan:id_plan(id,nombre,espacio_maximo_gb),estado:id_estado(nombre)');
    const current = new Map();
    for (const sub of subscriptions.filter(sub=>['Activa','PorVencer'].includes(sub.estado?.nombre) && isCurrent(sub)).sort((a,b)=>String(a.fecha_inicio).localeCompare(String(b.fecha_inicio)) || a.id-b.id)) current.set(sub.id_usuario,sub);

    const p = page === undefined ? 0 : Number(page);
    const parsedLimit = Number(limit);
    const parsedOffset = p > 0 ? (p - 1)*parsedLimit : Number(offset);
    if (!Number.isSafeInteger(p) || p < 0 || (page !== undefined && p===0) || !Number.isSafeInteger(parsedLimit) || parsedLimit<1 || parsedLimit>100 || !Number.isSafeInteger(parsedOffset) || parsedOffset<0) throw createServiceError('Paginación inválida',400,'INVALID_PAGINATION');
    let statusId=null;
    if (status !== undefined && status !== null && String(status).trim() !== '') {
      const states=await readAll('estado_usuario','id,nombre');
      const state=states.find(state=>String(state.id)===String(status) || state.nombre.toLowerCase()===String(status).trim().toLowerCase());
      if(!state)throw createServiceError('Estado inválido',400,'INVALID_USER_STATUS');
      statusId=state.id;
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
        if(searchTerm.length>200)throw createServiceError('Búsqueda demasiado larga',400,'INVALID_FILTER');
        const terms=searchTerm.trim().replace(/[,%()"\\]/g,' ').split(/\s+/).filter(Boolean).slice(0,8);
        for(const term of terms)query=query.or(`nombre.ilike.%${term}%,apellido.ilike.%${term}%,correo.ilike.%${term}%`);
      }

      if (statusId) {
        query = query.eq("id_estado", statusId);
      }

      if (plan) {
        if (plan === 'Sin suscripción activa') query=query.not('id','in',`(${[...current.keys()].join(',') || 0})`);
        else query=query.in('id',[...current].filter(([,sub])=>sub.plan?.nombre===plan).map(([id])=>id));
      }
      if (days) query=query.gte('fecha_registro',new Date(Date.now()-Number(days)*86400000).toISOString());
      if (sort === 'name') query=query.order('nombre',{ascending:true});
      if (sort === 'storage') query=query.order(storageCol,{ascending:false});
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

    const users = await Promise.all((data || []).map(async (u) => {
      const sub=current.get(u.id);
      const auth = u.auth_user_id ? await supabaseAdmin.auth.admin.getUserById(u.auth_user_id) : {data:{}};
      const metadata=auth.data?.user?.user_metadata || {};
      const signed=metadata.avatar_path ? await supabaseAdmin.storage.from('avatars').createSignedUrl(metadata.avatar_path,3600) : null;
      return ({
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
      usedBytes: Number(u.espacio_usado_bytes || u.espacio_usado_by || 0),
      plan: sub?.plan?.nombre || 'Sin suscripción activa',
      maxBytes: sub ? Number(sub.plan?.espacio_maximo_gb || 0)*BYTES_PER_GB : null,
      avatarUrl: signed?.data?.signedUrl || metadata.avatar_url || metadata.picture || null,
      espacio_usado_bytes: Number(u.espacio_usado_bytes || u.espacio_usado_by || 0),
      fecha_registro: u.fecha_registro,
    }); }));

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

    const subscriptions = await readAll('suscripcion','id,id_usuario,fecha_inicio,fecha_fin,plan:id_plan(id,nombre,espacio_maximo_gb),estado:id_estado(nombre)',q=>q.eq('id_usuario',userId));
    const subscription = subscriptions.filter(sub=>['Activa','PorVencer'].includes(sub.estado?.nombre) && isCurrent(sub)).sort((a,b)=>String(b.fecha_inicio).localeCompare(String(a.fecha_inicio)) || b.id-a.id)[0] || null;
    const maxBytes = subscription ? Number(subscription.plan?.espacio_maximo_gb || 0)*BYTES_PER_GB : null;
    const plan = subscription?.plan?.nombre || 'Sin suscripción activa';
    const auth=user.auth_user_id ? await supabaseAdmin.auth.admin.getUserById(user.auth_user_id) : {data:{}};
    const metadata=auth.data?.user?.user_metadata || {};
    const signed=metadata.avatar_path ? await supabaseAdmin.storage.from('avatars').createSignedUrl(metadata.avatar_path,3600) : null;
    const usedBytes = Number(user.espacio_usado_bytes || user.espacio_usado_by || 0);

    return {
      id: user.id,
      avatarUrl: signed?.data?.signedUrl || metadata.avatar_url || metadata.picture || null,
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
      .order("id", { ascending: false })
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
    const [users,subs,pagos,files]=await Promise.all([
      readAll('usuario','id,id_estado'),readAll('suscripcion','id,fecha_inicio,fecha_fin,id_estado',q=>q.in('id_estado',[2,3])),
      readAll('pago','id,monto',q=>q.eq('id_estado',1)),readAll('archivo','id,tamano_bytes',q=>q.in('id_estado',[1,2]))
    ]);
    const used=files.reduce((sum,f)=>sum+Number(f.tamano_bytes),0);
    return {totalUsuarios:users.length,usuariosActivos:users.filter(u=>u.id_estado===1).length,
      totalSuscripcionesActivas:subs.filter(s=>isCurrent(s)).length,ingresosTotales:totalMoney(pagos),
      almacenamientoUsadoBytes:used,almacenamientoUsadoGb:Number((used/BYTES_PER_GB).toFixed(2))};
  },

  /**
   * Métricas agregadas de almacenamiento global consumido.
   */
  async getStorageMetrics() {
    const archivos=await readAll('archivo','id,nombre,tamano_bytes',q=>q.in('id_estado',[1,2]));

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
    const {p,l,from,to}=pagination(page,limit);
    const catalogStatuses=await readAll('estado_suscripcion','id,nombre');
    let q=supabaseAdmin.from('suscripcion').select('id,fecha_inicio,fecha_fin,id_usuario,id_plan,id_estado,estado:id_estado(id,nombre)',{count:'exact'});
    if (status !== undefined && status !== '') {
      const state=catalogStatuses.find(s=>String(s.id)===String(status)||s.nombre.toLowerCase()===String(status).toLowerCase());
      if (!state) throw createServiceError('Estado inválido',400,'INVALID_SUBSCRIPTION_STATUS');
      q=q.eq('id_estado',state.id);
    }
    const {data:subs,count,error}=await q.order('id',{ascending:false}).range(from,to);
    if (error) throw error;
    if (!subs || subs.length === 0) {
      return {
        subscriptions: [],
        pagination: {
          currentPage: p,
          pageSize: l,
          totalRecords: count || 0,
          totalPages: Math.ceil((count || 0)/l)
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

    if (usersRes.error) throw usersRes.error;
    if (plansRes.error) throw plansRes.error;
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
    if ((startDate && !calendarDate(startDate)) || (endDate && !calendarDate(endDate)) || (startDate && endDate && startDate>endDate))
      throw createServiceError('Rango de fechas inválido',400,'INVALID_REPORT_DATES');
    const pagos=await readAll('pago','id,monto,fecha_pago,id_estado,referencia,suscripcion(plan(id,nombre))',q=>{
      q=q.eq('id_estado',1);
      if(startDate)q=q.gte('fecha_pago',startDate);
      if(endDate)q=q.lte('fecha_pago',endDate);
      return q;
    });
    pagos.sort((a,b)=>String(b.fecha_pago).localeCompare(String(a.fecha_pago)) || b.id-a.id);
    const totalRecaudado=totalMoney(pagos);

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
