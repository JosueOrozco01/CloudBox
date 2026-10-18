const { createClient } = require("@supabase/supabase-js");

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

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
    const now = Date.now();
    const active = subscriptions.filter(
      (sub) =>
        sub.estado?.nombre === "Activa" &&
        (!sub.fecha_fin || new Date(sub.fecha_fin).getTime() >= now),
    );
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
                !sub.fecha_fin ||
                new Date(sub.fecha_fin).getTime() > now + 7 * 86400000,
            ).length,
            color: "#16a34a",
          },
          {
            id: "expiring",
            label: "Próximas a vencer (7 días)",
            count: active.filter(
              (sub) =>
                sub.fecha_fin &&
                new Date(sub.fecha_fin).getTime() <= now + 7 * 86400000,
            ).length,
            color: "#f59e0b",
          },
          {
            id: "expired",
            label: "Vencidas",
            count: subscriptions.filter(
              (sub) =>
                sub.estado?.nombre === "Vencida" ||
                (sub.fecha_fin && new Date(sub.fecha_fin).getTime() < now),
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
};

module.exports = AdminService;
