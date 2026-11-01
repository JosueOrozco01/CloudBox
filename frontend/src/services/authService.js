import { normalizeApiUrl, authenticatedFetch } from "./dashboardService";
import { resetAppearance, restoreCachedPreferences } from "../utils/preferences.js";

const API_URL = `${normalizeApiUrl(import.meta.env.VITE_API_URL)}/auth`;

export function persistSession(data) {
  localStorage.setItem('token', data.token);
  localStorage.setItem('refreshToken', data.refreshToken);
  localStorage.setItem('user', JSON.stringify(data.user));
  restoreCachedPreferences();
  window.dispatchEvent(new Event('cloudbox:session-changed'));
}
export function clearSession(expectedToken = localStorage.getItem('token')) {
  if (localStorage.getItem('token') !== expectedToken) return false;
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  localStorage.removeItem('justLoggedIn');
  resetAppearance();
  window.dispatchEvent(new Event('cloudbox:session-changed'));
  return true;
}

export const login = async (email, password) => {
  const response = await authenticatedFetch(`${API_URL}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Error al iniciar sesión");
  }

  persistSession(data);

  return data;
};

export const logout = async () => {
  const accessToken = localStorage.getItem("token");
  const refreshToken = localStorage.getItem("refreshToken");

  if (!accessToken || !refreshToken) {
    clearSession(accessToken);
    return;
  }

  const response = await authenticatedFetch(`${API_URL}/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      accessToken,
      refreshToken,
    }),
  });

  const data = await response.json();

  if (!clearSession(accessToken)) return { sessionChanged: true };

  if (!response.ok) {
    throw new Error(data.message || "Error al cerrar sesión");
  }

  return data;
};

export const getCurrentUser = () => {
  const user = localStorage.getItem("user");

  if (!user) {
    return null;
  }

  try {
    return JSON.parse(user);
  } catch {
    return null;
  }
};

export const getSession = () => {
  const token = localStorage.getItem("token");
  const refreshToken = localStorage.getItem("refreshToken");

  if (!token || !refreshToken) {
    return null;
  }

  return {
    access_token: token,
    refresh_token: refreshToken,
  };
};