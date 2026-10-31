import { api } from './apiClient';
export const getSubscription = () => api('/subscriptions/current').then(r => r.data);
export const getSubscriptionHistory = () => api('/subscriptions/history').then(r => r.data);
export const getQuota = () => api('/storage/quota-summary').then(r => r.data);
export const subscriptionAction = (action, body) => api(`/subscriptions/${action}`, {
  method: action === 'cancel' ? 'PATCH' : 'POST',
  body
}).then(r => r.data);
