import { normalizeApiUrl, authenticatedFetch } from "./dashboardService";
import { getReadCacheRevision, onReadCacheInvalidated } from './readCache';
const API_URL = `${normalizeApiUrl(import.meta.env.VITE_API_URL)}/users`;
let verifiedProfile;
onReadCacheInvalidated(() => { verifiedProfile = null; });
export function getCachedProfile() {
  return verifiedProfile?.token === localStorage.getItem('token')
    && verifiedProfile.revision === getReadCacheRevision()
    && verifiedProfile.expires > Date.now() ? verifiedProfile.data : null;
}

export const getMyProfile = async ({ force = false } = {}) => {
  const cached = !force && getCachedProfile();
  if (cached) return cached;
  const token = localStorage.getItem("token");
  const revision = getReadCacheRevision();

  if (!token) {
    const error = new Error("No hay una sesión activa");
    error.status = 401;
    throw error;
  }

  const response = await authenticatedFetch(`${API_URL}/me`, {
    method: "GET",
    ...(force ? { cache: 'no-store' } : {}),
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.message || "Error al obtener el perfil");
    error.status = response.status;
    error.code = data.code;
    throw error;
  }

  if (!data.data?.id) {
    throw new Error("El servidor no devolvió un perfil válido");
  }

  if (token === localStorage.getItem('token') && revision === getReadCacheRevision()) {
    verifiedProfile = { token, revision, expires: Date.now() + 30000, data: data.data };
  }
  return data.data;
};

export const updateMyProfile = async (nombre, apellido) => {
  const token = localStorage.getItem("token");

  if (!token) {
    throw new Error("No hay una sesión activa");
  }

  const response = await authenticatedFetch(
    `${normalizeApiUrl(import.meta.env.VITE_API_URL)}/users/me`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ nombre, apellido }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "No se pudo actualizar el perfil");
  }

  return data.data;
};

export const getMyStorage = async () => {
  const token = localStorage.getItem("token");

  if (!token) {
    throw new Error("No hay una sesión activa");
  }

  const response = await authenticatedFetch(
    `${normalizeApiUrl(import.meta.env.VITE_API_URL)}/users/me/storage`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "No se pudo obtener el almacenamiento"
    );
  }

  return data.data;
};

export const deactivateMyAccount = async (password) => {
  const token = localStorage.getItem("token");

  if (!token) {
    throw new Error("No hay una sesión activa");
  }

  const response = await authenticatedFetch(
    `${normalizeApiUrl(import.meta.env.VITE_API_URL)}/users/me/deactivate`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ password }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "No se pudo desactivar la cuenta"
    );
  }

  return data;
};
