const { countsTowardStorage } = require('./storage-policy');
const { readPages } = require('./commercial-policy');
const { createClient } = require("@supabase/supabase-js");

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const BYTES_PER_GB = 1024 * 1024 * 1024;
const DEFAULT_FREE_QUOTA_BYTES = 1 * BYTES_PER_GB;

function createServiceError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function normalizeDateStr(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().split("T")[0];
  const str = String(val).trim();
  if (str.includes("T")) return str.split("T")[0];
  return str.substring(0, 10);
}

async function readAll(table, columns) {
  return readPages(() => supabaseAdmin.from(table).select(columns).order('id'));
}

async function readAllSafe(table, columns) {
  return readAll(table, columns);
}

const AdminStorageService = {
  /**
   * Módulo STO: Estadísticas generales de almacenamiento y archivos.
   * Retorna espacio total (bytes y GB), conteo de archivos/carpetas no eliminados,
   * distribución por tipo (PDF, imágenes, documentos, otros) y distribución por estado.
   */
  async getStorageOverview() {
    const [files, folders, fileStates] = await Promise.all([
      readAllSafe("archivo", "id,nombre,tamano_bytes,id_usuario,id_estado,storage_deleted_at,estado:id_estado(id,nombre)"),
      readAllSafe("carpeta", "id,nombre,id_usuario,id_estado"),
      readAllSafe("estado_archivo", "id,nombre"),
    ]);

    // Excluir eliminados lógicos: id_estado != 3, eliminado != true y estado != 'Eliminado'
    const nonDeletedFiles = files.filter(countsTowardStorage);

    const nonDeletedFolders = folders.filter(f =>
      f.id_estado !== 3 &&
      f.eliminado !== true &&
      f.estado?.nombre !== "Eliminado"
    );

    // Espacio total utilizado globalmente
    const totalBytes = nonDeletedFiles.reduce((sum, f) => sum + Number(f.tamano_bytes || 0), 0);
    const totalGB = Number((totalBytes / BYTES_PER_GB).toFixed(2));

    // Distribución por extensión / tipo
    const typeDistribution = {
      pdf: { cantidad: 0, bytes: 0, count: 0 },
      imagenes: { cantidad: 0, bytes: 0, count: 0 },
      documentos: { cantidad: 0, bytes: 0, count: 0 },
      otros: { cantidad: 0, bytes: 0, count: 0 }
    };

    const imageExtensions = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "tiff"]);
    const docExtensions = new Set(["doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "rtf", "odt", "ods"]);

    nonDeletedFiles.forEach(file => {
      const bytes = Number(file.tamano_bytes || 0);
      const name = file.nombre || "";
      const dotIndex = name.lastIndexOf(".");
      const ext = dotIndex > 0 ? name.slice(dotIndex + 1).toLowerCase() : "";

      if (ext === "pdf") {
        typeDistribution.pdf.cantidad += 1;
        typeDistribution.pdf.count += 1;
        typeDistribution.pdf.bytes += bytes;
      } else if (imageExtensions.has(ext)) {
        typeDistribution.imagenes.cantidad += 1;
        typeDistribution.imagenes.count += 1;
        typeDistribution.imagenes.bytes += bytes;
      } else if (docExtensions.has(ext)) {
        typeDistribution.documentos.cantidad += 1;
        typeDistribution.documentos.count += 1;
        typeDistribution.documentos.bytes += bytes;
      } else {
        typeDistribution.otros.cantidad += 1;
        typeDistribution.otros.count += 1;
        typeDistribution.otros.bytes += bytes;
      }
    });

    // Distribución por estado de archivo
    const statusMap = new Map();
    fileStates.forEach(st => {
      if (st.id !== 3 && st.nombre !== "Eliminado") {
        statusMap.set(st.nombre, { id: st.id, estado: st.nombre, cantidad: 0, count: 0, bytes: 0 });
      }
    });

    nonDeletedFiles.forEach(file => {
      const stateName = file.id_estado === 3 ? "Borrado físico pendiente" : file.estado?.nombre || (file.id_estado === 2 ? "En papelera" : "Activo");
      const bytes = Number(file.tamano_bytes || 0);

      if (!statusMap.has(stateName)) {
        statusMap.set(stateName, { id: file.id_estado, estado: stateName, cantidad: 0, count: 0, bytes: 0 });
      }

      const entry = statusMap.get(stateName);
      entry.cantidad += 1;
      entry.count += 1;
      entry.bytes += bytes;
    });

    const statusDistribution = Array.from(statusMap.values());

    return {
      espacio_total_bytes: totalBytes,
      espacio_total_gb: totalGB,
      totalBytes,
      totalGB,
      total_archivos: nonDeletedFiles.length,
      total_carpetas: nonDeletedFolders.length,
      totalFiles: nonDeletedFiles.length,
      totalFolders: nonDeletedFolders.length,
      distribucion_tipo: typeDistribution,
      distributionByType: typeDistribution,
      distribucion_estado: statusDistribution,
      distributionByStatus: statusDistribution,
    };
  },

  /**
   * Módulo STO: Consulta paginada de almacenamiento por usuario.
   * Detalla: id_usuario, nombre, correo, espacio_usado_bytes, maxBytes, porcentaje_uso,
   * cantidad de archivos y cantidad de carpetas.
   * Filtro booleano overQuota para identificar usuarios que exceden su cuota.
   */
  async getStorageUsers({ limit = 20, offset = 0, overQuota = false, all = false } = {}) {
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const parsedOffset = Math.max(0, parseInt(offset, 10) || 0);
    const filterOverQuota = overQuota === true || overQuota === "true" || overQuota === 1 || overQuota === "1";

    let users = [];
    try {
      users = await readAll("usuario", "id,nombre,apellido,correo,espacio_usado_by,fecha_registro");
    } catch (err) {
      if (err.message && (err.message.includes("column") || err.message.includes("42703") || err.message.includes("does not exist"))) {
        users = await readAll("usuario", "id,nombre,apellido,correo,espacio_usado_bytes,fecha_registro");
      } else {
        throw err;
      }
    }

    const [subscriptions, files, folders] = await Promise.all([
      readAllSafe("suscripcion", "id,id_usuario,fecha_inicio,fecha_fin,plan:id_plan(id,nombre,espacio_maximo_gb),estado:id_estado(nombre)"),
      readAllSafe("archivo", "id,id_usuario,tamano_bytes,id_estado,storage_deleted_at"),
      readAllSafe("carpeta", "id,id_usuario,id_estado"),
    ]);

    const today = normalizeDateStr(new Date());

    // Suscripciones vigentes: estados 'Activa' o 'PorVencer' y fecha válida
    const validSubs = subscriptions.filter(sub => {
      const state = sub.estado?.nombre;
      if (!["Activa", "PorVencer"].includes(state)) return false;
      const startDate = normalizeDateStr(sub.fecha_inicio);
      const endDate = normalizeDateStr(sub.fecha_fin);
      if (startDate && startDate > today) return false;
      if (endDate && endDate < today) return false;
      return true;
    });

    // Mapeo por usuario de archivos y carpetas no eliminados (id_estado != 3)
    const nonDeletedFiles = files.filter(countsTowardStorage);
    const nonDeletedFolders = folders.filter(f => f.id_estado !== 3 && f.eliminado !== true);

    const userFileCounts = new Map();
    const userFileBytes = new Map();
    for (const f of nonDeletedFiles) {
      userFileCounts.set(f.id_usuario, (userFileCounts.get(f.id_usuario) || 0) + 1);
      userFileBytes.set(f.id_usuario, (userFileBytes.get(f.id_usuario) || 0) + Number(f.tamano_bytes || 0));
    }

    const userFolderCounts = new Map();
    for (const f of nonDeletedFolders) {
      userFolderCounts.set(f.id_usuario, (userFolderCounts.get(f.id_usuario) || 0) + 1);
    }

    // Mapa de suscripción más reciente por usuario
    const userSubMap = new Map();
    for (const sub of validSubs) {
      const existing = userSubMap.get(sub.id_usuario);
      if (!existing || new Date(sub.fecha_inicio) > new Date(existing.fecha_inicio)) {
        userSubMap.set(sub.id_usuario, sub);
      }
    }

    let computedUsers = users.map(user => {
      const sub = userSubMap.get(user.id);
      const planName = sub?.plan?.nombre || "Plan Básico Gratuito";
      const maxBytes = sub?.plan?.espacio_maximo_gb
        ? Number(sub.plan.espacio_maximo_gb) * BYTES_PER_GB
        : DEFAULT_FREE_QUOTA_BYTES;

      const recordedBytes = Number(user.espacio_usado_by ?? user.espacio_usado_bytes ?? 0);
      const calculatedBytes = userFileBytes.get(user.id) || 0;
      const espacioConsumido = calculatedBytes;

      const percentageUsed = maxBytes > 0
        ? Number(((espacioConsumido / maxBytes) * 100).toFixed(2))
        : 0;

      const fileCount = userFileCounts.get(user.id) || 0;
      const folderCount = userFolderCounts.get(user.id) || 0;
      const isOverQuota = espacioConsumido > maxBytes;

      return {
        id_usuario: user.id,
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido,
        nombre_completo: [user.nombre, user.apellido].filter(Boolean).join(" "),
        correo: user.correo,
        espacio_usado_bytes: espacioConsumido,
        espacio_usado_by: espacioConsumido,
        usedBytes: espacioConsumido,
        recordedBytes,
        storageSyncPending: recordedBytes !== calculatedBytes,
        maxBytes,
        porcentaje_uso: percentageUsed,
        percentageUsed,
        cantidad_archivos: fileCount,
        fileCount,
        cantidad_carpetas: folderCount,
        folderCount,
        sobre_cuota: isOverQuota,
        overQuota: isOverQuota,
        plan: planName,
        fecha_registro: user.fecha_registro,
      };
    });

    if (filterOverQuota) {
      computedUsers = computedUsers.filter(u => u.overQuota);
    }

    // Orden estable: mayor espacio usado primero, luego id ascendente
    computedUsers.sort((a, b) => b.espacio_usado_bytes - a.espacio_usado_bytes || a.id_usuario - b.id_usuario);


    const total = computedUsers.length;
    const pagedUsers = all ? computedUsers : computedUsers.slice(parsedOffset, parsedOffset + parsedLimit);

    return {
      users: pagedUsers,
      pagination: {
        limit: parsedLimit,
        offset: parsedOffset,
        total,
      },
    };
  },

  /**
   * Módulo STO: Alias directo para listar usuarios sobre cuota.
   */
  async getUsersOverQuota({ limit = 20, offset = 0 } = {}) {
    return this.getStorageUsers({ limit, offset, overQuota: true });
  },
};

module.exports = AdminStorageService;
