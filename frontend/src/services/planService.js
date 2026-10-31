import { api } from './apiClient';
export const getPlans = () => api('/plans', {
  publicAccess: true
}).then(r => r.data);
export const getPlan = id => api(`/plans/${id}`).then(r => r.data);
export const savePlan = (id, body) => api(`/plans${id ? `/${id}` : ''}`, {
  method: id ? 'PUT' : 'POST',
  body
});
export const setPlanStatus = (id, id_estado) => api(`/plans/${id}/status`, {
  method: 'PATCH',
  body: {
    id_estado
  }
});
export const getAdminPlans = () => api('/plans/admin/all').then(r => r.data);
