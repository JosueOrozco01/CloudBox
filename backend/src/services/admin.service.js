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

  async updateUserStatus(targetUserId, newStatusId) {
    if (
      !Number.isSafeInteger(targetUserId) ||
      targetUserId <= 0 ||
      !Number.isSafeInteger(newStatusId) ||
      newStatusId <= 0
    ) {
      const error = new Error("El identificador solicitado no es válido.");
      error.status = 400;
      throw error;
    }
    const { data: catalogEntry, error: catalogError } = await supabaseAdmin
      .from("estado_usuario")
      .select("id")
      .eq("id", newStatusId)
      .maybeSingle();
    if (catalogError) throw catalogError;
    if (!catalogEntry) {
      const error = new Error(
        "La opción seleccionada no existe en el catálogo.",
      );
      error.status = 400;
      throw error;
    }
    const { data, error } = await supabaseAdmin
      .from("usuario")
      .update({ id_estado: newStatusId })
      .eq("id", targetUserId)
      .select("id, nombre, id_estado")
      .single();

    if (error) {
      throw new Error(
        `Error al actualizar estado del usuario: ${error.message}`,
      );
    }

    return data;
  },

  async updateUserRole(targetUserId, newRoleId) {
    if (
      !Number.isSafeInteger(targetUserId) ||
      targetUserId <= 0 ||
      !Number.isSafeInteger(newRoleId) ||
      newRoleId <= 0
    ) {
      const error = new Error("El identificador solicitado no es válido.");
      error.status = 400;
      throw error;
    }
    const { data: catalogEntry, error: catalogError } = await supabaseAdmin
      .from("rol")
      .select("id")
      .eq("id", newRoleId)
      .maybeSingle();
    if (catalogError) throw catalogError;
    if (!catalogEntry) {
      const error = new Error(
        "La opción seleccionada no existe en el catálogo.",
      );
      error.status = 400;
      throw error;
    }
    const { data, error } = await supabaseAdmin
      .from("usuario")
      .update({ id_rol: newRoleId })
      .eq("id", targetUserId)
      .select("id, nombre, id_rol")
      .single();

    if (error) {
      throw new Error(`Error al actualizar rol del usuario: ${error.message}`);
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
   * Listado paginado de usuarios con rol, estado y cuota usada.
   */
  async getUsersList({ page = 1, limit = 20, search = '', status } = {}) {
    const {p,l,from,to}=pagination(page,limit);
    let stateId;
    if (status !== undefined && status !== '') {
      const states=await readAll('estado_usuario','id,nombre');
      stateId=states.find(s=>String(s.id)===String(status)||s.nombre.toLowerCase()===String(status).toLowerCase())?.id;
      if (!stateId) throw createServiceError('Estado inválido',400,'INVALID_USER_STATUS');
    }
    let q=supabaseAdmin.from('usuario').select('id,nombre,apellido,correo,espacio_usado_by,fecha_registro,rol:id_rol(nombre),estado:id_estado(nombre)',{count:'exact'});
    if (search) {
      const pattern=JSON.stringify('%'+String(search).replace(/[\\%_]/g,'\\$&')+'%');
      q=q.or(['nombre','apellido','correo'].map(k=>k+'.ilike.'+pattern).join(','));
    }
    if (stateId) q=q.eq('id_estado',stateId);
    const {data,count,error}=await q.order('id').range(from,to);

    if (error) {
      throw createServiceError(`Error al listar usuarios admin: ${error.message}`, 500, 'DATABASE_ERROR');
    }

    return {
      users: (data || []).map(u => ({
        id: u.id,
        nombre: u.nombre,
        apellido: u.apellido,
        correo: u.correo,
        rol: u.rol?.nombre || 'Cliente',
        estado: u.estado?.nombre || 'Activo',
        espacio_usado_bytes: Number(u.espacio_usado_bytes || u.espacio_usado_by || 0),
        fecha_registro: u.fecha_registro
      })),
      pagination: {
        currentPage: p,
        pageSize: l,
        totalRecords: count || 0,
        totalPages: Math.ceil((count || 0) / l)
      }
    };
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
