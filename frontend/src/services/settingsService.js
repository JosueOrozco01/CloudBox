import { request } from "./dashboardService";
export const getPreferences = () => request('/users/me/preferences');
export const getSecurity = () => request('/users/me/security');
export const logoutOtherSessions = () => request('/users/me/logout-others', { method: 'POST' });
const patch = (path, data) => request(path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
export const changePassword = data => patch('/users/me/password', data);
export const savePreferences = data => patch('/users/me/preferences', { theme: data.theme, language: data.language, showKB: data.showKB, notifications: data.notifications?.map(({ id, enabled }) => ({ id, enabled })) });
