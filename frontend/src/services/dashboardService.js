export function normalizeApiUrl(url) {
  const base = (url || "http://localhost:3000").replace(/\/+$/, "");
  return base.endsWith("/api") ? base : `${base}/api`;
}

const API_URL = normalizeApiUrl(import.meta.env?.VITE_API_URL);

async function request(path, options = {}) {
  const token = localStorage.getItem("token");
  if (!token) {
    const error = new Error("No hay una sesión activa");
    error.status = 401;
    throw error;
  }
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}` },
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(
      result.message || "No se pudo completar la operación",
    );
    error.status = response.status;
    error.code = result.code;
    throw error;
  }
  return result.data;
}

export const getStorageMetrics = () =>
  request("/users/me/storage").catch((error) => {
    if (error.code === "NO_ACTIVE_SUBSCRIPTION") return null;
    throw error;
  });
export const getDashboard = async () => {
  const [summary, storage] = await Promise.all([
    request("/dashboard?includeStorage=false"),
    getStorageMetrics(),
  ]);
  return { ...summary, storage };
};
export const getUserFiles = (folderId = null) =>
  request(`/files?folderId=${folderId ?? "null"}`);
export const getFolderContent = (folderId = "root") =>
  request(`/folders/${folderId}/content`);
export const getUserFolders = (folderId = null) =>
  request(folderId ? `/folders/${folderId}/subfolders` : "/folders");
export const uploadDashboardFile = (file, onProgress, folderId = null) => {
  const body = new FormData();
  body.append("file", file);
  if (folderId !== null) body.append("folderId", String(folderId));
  if (onProgress)
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_URL}/files/upload`);
      xhr.setRequestHeader(
        "Authorization",
        `Bearer ${localStorage.getItem("token")}`,
      );
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable)
          onProgress(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onload = () => {
        try {
          const result = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) resolve(result.data);
          else
            reject(new Error(result.message || "No se pudo subir el archivo"));
        } catch {
          reject(new Error("Respuesta del servidor no válida"));
        }
      };
      xhr.onerror = () =>
        reject(new Error("No se pudo conectar con el servidor"));
      xhr.timeout = 120000;
      xhr.ontimeout = () =>
        reject(new Error("La subida tardó demasiado. Inténtalo nuevamente."));
      xhr.send(body);
    });
  return request("/files/upload", { method: "POST", body });
};
export const createDashboardFolder = (nombre, parentId = null) =>
  request("/folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre, id_padre: parentId }),
  });
export const getFileDownloadUrl = (id) => request(`/files/${id}/download-url`);
export const getTrashFiles = () => request("/files/trash");
export const getTrashFolders = () => request("/folders/trash");
const jsonMutation = (path, method, body) =>
  request(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
export const renameItem = (item, name) =>
  item.type === "carpeta"
    ? jsonMutation(`/folders/${item.rawId}`, "PUT", { nombre: name })
    : jsonMutation(`/files/${item.rawId}/rename`, "PATCH", { name });
export const trashItem = (item) =>
  request(
    item.type === "carpeta"
      ? `/folders/${item.rawId}`
      : `/files/${item.rawId}/trash`,
    { method: item.type === "carpeta" ? "DELETE" : "PATCH" },
  );
export const restoreItem = (item) =>
  request(
    `/${item.type === "carpeta" ? "folders" : "files"}/${item.rawId}/restore`,
    { method: "PATCH" },
  );
export const moveItem = (item, destination) =>
  item.type === "carpeta"
    ? jsonMutation(`/folders/${item.rawId}/move`, "PATCH", {
        id_padre: destination,
      })
    : jsonMutation(`/files/${item.rawId}/move`, "PATCH", {
        folderId: destination,
      });
export async function getFolderLocations() {
  const locations = [];
  const visited = new Set();
  async function visit(parent = null, prefix = "") {
    const folders = await getUserFolders(parent);
    for (const folder of folders) {
      if (visited.has(folder.id)) continue;
      visited.add(folder.id);
      const name = prefix + folder.nombre;
      locations.push({ id: folder.id, name });
      await visit(folder.id, `${name} / `);
    }
  }
  await visit();
  return locations;
}

export function toDashboardProps(data) {
  const metrics = data.storage;
  const gb = 1024 ** 3;
  return {
    storage: metrics
      ? {
          usedGB: metrics.usedBytes / gb,
          totalGB: metrics.maxBytes / gb,
          availableGB: metrics.availableBytes / gb,
          percentageUsed: metrics.percentageUsed,
        }
      : null,
    fileCount: data.fileCount,
    folderCount: data.folderCount,
    plan: metrics
      ? {
          name: metrics.plan.nombre,
          renewDate: metrics.subscription?.fecha_fin
            ? new Date(
                `${metrics.subscription.fecha_fin.slice(0, 10)}T00:00:00`,
              ).toLocaleDateString("es-GT")
            : null,
        }
      : null,
    recentFiles: data.recentFiles.slice(0, 5).map((file) => {
      const extension = file.nombre.split(".").pop().toLowerCase();
      const type = ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(
        extension,
      )
        ? "image"
        : extension;
      const bytes = Number(file.tamano_bytes);
      const size =
        bytes >= 1024 ** 2
          ? `${(bytes / 1024 ** 2).toFixed(2)} MB`
          : `${(bytes / 1024).toFixed(2)} KB`;
      return {
        id: file.id,
        name: file.nombre,
        type,
        meta: `${extension.toUpperCase()} · ${size}`,
        date: new Date(
          file.fecha_subida || file.fecha_modificacion,
        ).toLocaleDateString("es-GT"),
      };
    }),
  };
}
