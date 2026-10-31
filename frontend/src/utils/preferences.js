const themes = ['claro', 'oscuro', 'sistema'];
const defaults = { theme: 'claro', showKB: true };
let appearanceOwner = null;

function sessionUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
}
function ownsSession(userId, token) {
  const user = sessionUser();
  return Boolean(token && token === localStorage.getItem('token') && userId != null && (user?.id == null || String(user.id) === String(userId)));
}
function cached(userId) {
  try {
    const saved = JSON.parse(localStorage.getItem(`cloudbox:preferences:${userId}`) || 'null');
    return saved && themes.includes(saved.theme) ? saved : null;
  } catch { return null; }
}
function renderPreferences(preferences) {
  previewTheme(preferences.theme);
  document.documentElement.dataset.sizeUnit = preferences.showKB === true ? 'KB' : 'MB';
  document.documentElement.lang = 'es';
}
export function previewTheme(theme) {
  const normalized = themes.includes(theme) ? theme : 'claro';
  const system = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = normalized === 'oscuro' || (normalized === 'sistema' && system) ? 'dark' : 'light';
  document.documentElement.dataset.themeMode = normalized;
}
export function resetAppearance() {
  appearanceOwner = null;
  renderPreferences(defaults);
}
// Activate only this account's cache; a missing cache starts with light mode.
export function beginAccountAppearance(userId, token = localStorage.getItem('token')) {
  if (!ownsSession(userId, token)) return false;
  appearanceOwner = { userId: String(userId), token };
  renderPreferences(cached(userId) || defaults);
  return true;
}
export function applyPreferences(userId, preferences, token = localStorage.getItem('token')) {
  if (!ownsSession(userId, token)) return false;
  if (appearanceOwner?.token === token && appearanceOwner.userId !== String(userId)) return false;
  appearanceOwner = { userId: String(userId), token };
  const normalized = { ...preferences, theme: themes.includes(preferences?.theme) ? preferences.theme : defaults.theme, showKB: typeof preferences?.showKB === 'boolean' ? preferences.showKB : defaults.showKB };
  try { localStorage.setItem(`cloudbox:preferences:${userId}`, JSON.stringify(normalized)); } catch { /* The server remains the source of truth. */ }
  renderPreferences(normalized);
  window.dispatchEvent(new Event('cloudbox-preferences-changed'));
  return true;
}
export function previewAccountTheme(userId, theme, token) {
  if (!ownsSession(userId, token) || appearanceOwner?.userId !== String(userId) || appearanceOwner.token !== token) return false;
  previewTheme(theme);
  return true;
}
// Cleanup from an old account or a signed-out session must never change the screen.
export function restoreAccountAppearance(userId, token) {
  if (!ownsSession(userId, token) || appearanceOwner?.userId !== String(userId) || appearanceOwner.token !== token) return false;
  renderPreferences(cached(userId) || defaults);
  return true;
}
export function formatFileSize(bytes) {
  return document.documentElement.dataset.sizeUnit === 'KB' ? `${(Number(bytes) / 1024).toFixed(2)} KB` : `${(Number(bytes) / 1024 ** 2).toFixed(2)} MB`;
}
export function restoreCachedPreferences() {
  resetAppearance();
  const user = sessionUser();
  if (user?.id != null) beginAccountAppearance(user.id);
}
