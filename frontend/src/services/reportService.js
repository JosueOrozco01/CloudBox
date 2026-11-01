import { normalizeApiUrl, authenticatedFetch } from './dashboardService';
import { api, query } from './apiClient';
export const getReport = values => api(`/admin/reports/${values.type}?${query({
  from: values.from,
  to: values.to
})}`).then(r => r.data);
export async function exportReport(values) {
  const response = await authenticatedFetch(`${normalizeApiUrl(import.meta.env.VITE_API_URL)}/admin/reports/export?${query(values)}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`
    }
  });
  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.message || 'No se pudo exportar el reporte.');
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `cloudbox-${values.type}.${values.format}`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
