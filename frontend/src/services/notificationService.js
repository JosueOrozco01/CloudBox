import { api, query } from './apiClient';
export const getNotifications = ({
  unread = false,
  ...page
} = {}) => api(`/notifications${unread ? '/unread' : ''}?${query(page)}`).then(r => r.data);
export const markNotificationRead = id => api(`/notifications/${id}/read`, {
  method: 'PATCH'
});
export const markAllNotificationsRead = () => api('/notifications/read-all', {
  method: 'PATCH'
});
export const deleteNotification = id => api(`/notifications/${id}`, {
  method: 'DELETE'
});
