import { api, query } from './apiClient';
import { normalizeApiUrl } from "./dashboardService";

const API_URL = normalizeApiUrl(import.meta.env.VITE_API_URL);

async function request(path, method = "GET", body) {
  const response = await fetch(`${API_URL}/admin${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(
      result.message || "No se pudo completar la operación.",
    );
    error.status = response.status;
    throw error;
  }
  if (method !== "GET")
    window.dispatchEvent(new Event("admin-activity-changed"));
  return result.data;
}

export const getAdminOverview = () => request("/overview");
export const getAdminActivity = (limit = 20, offset = 0) =>
  request(`/audit-logs?limit=${limit}&offset=${offset}`);
export const updateUserStatus = (id, id_estado) =>
  request(`/users/${id}/status`, "PATCH", { id_estado });
export const updateUserRole = (id, id_rol) =>
  request(`/users/${id}/role`, "PATCH", { id_rol });

export const mapAdminUser = (user) => ({
  ...user,
  name: [user.nombre, user.apellido].filter(Boolean).join(" "),
  email: user.correo,
  status: user.estado_usuario?.nombre || "Sin estado",
  registered: user.fecha_registro
    ? new Date(user.fecha_registro).toLocaleDateString("es-GT")
    : "—",
  storage: `${(user.usedBytes / 1024 ** 3).toFixed(2)} GB`,
});

// Paginated administration APIs keep metadata alongside data.
export const getAdminSubscriptions = filters => api(`/admin/subscriptions?${query(filters)}`);
export const getStorageOverview = () => api('/admin/storage/overview').then(r => r.data);
export const getStorageUsers = ({ overQuota, ...page }) => api(`/admin/storage/${overQuota ? 'over-quota' : 'users'}?${query(page)}`);
