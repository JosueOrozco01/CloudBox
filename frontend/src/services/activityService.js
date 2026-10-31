import { api, query } from './apiClient';
export const getActivity = filters => api(`/activity?${query(filters)}`).then(r => r.data);
