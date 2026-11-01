import { normalizeApiUrl, authenticatedFetch } from './dashboardService';
const API_URL = normalizeApiUrl(import.meta.env.VITE_API_URL);

// Keeps the full envelope for endpoints that return pagination outside data.
export async function api(path, {
  method = 'GET',
  body,
  publicAccess = false,
  signal
} = {}) {
  const token = localStorage.getItem('token');
  const response = await authenticatedFetch(`${API_URL}${path}`, {
    method,
    signal,
    headers: {
      ...(!publicAccess && token ? {
        Authorization: `Bearer ${token}`
      } : {}),
      ...(body !== undefined ? {
        'Content-Type': 'application/json'
      } : {})
    },
    ...(body !== undefined ? {
      body: JSON.stringify(body)
    } : {})
  });
  const result = response.status === 204 ? {} : await response.json();
  if (!response.ok || result.success === false) {
    const error = new Error(result.message || (response.status === 402 ? 'El pago fue rechazado. La operación no se completó.' : 'No se pudo completar la operación.'));
    Object.assign(error, {
      status: response.status,
      code: result.code,
      data: result.data
    });
    throw error;
  }
  return result;
}
export const query = values => {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) params.set(key, String(value));
  });
  return params.toString();
};
