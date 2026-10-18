export function previewTheme(theme) {
  const system = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = theme === 'oscuro' || (theme === 'sistema' && system) ? 'dark' : 'light';
  document.documentElement.dataset.themeMode = theme;
}
export function applyPreferences(userId, preferences) {
  try { localStorage.setItem(`cloudbox:preferences:${userId}`, JSON.stringify(preferences)); } catch { /* The server remains the source of truth. */ }
  previewTheme(preferences.theme);
  document.documentElement.dataset.sizeUnit = preferences.showKB ? 'KB' : 'MB';
  document.documentElement.lang = 'es';
  window.dispatchEvent(new Event('cloudbox-preferences-changed'));
}
export function formatFileSize(bytes) {
  return document.documentElement.dataset.sizeUnit === 'KB' ? `${(Number(bytes) / 1024).toFixed(2)} KB` : `${(Number(bytes) / 1024 ** 2).toFixed(2)} MB`;
}

// Restore the account's cached appearance before the first loading screen.
// The authenticated request will replace it with the saved server preferences.
export function restoreCachedPreferences() {
  try {
    if (!localStorage.getItem('token')) return;
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user?.id) return;
    const saved = JSON.parse(localStorage.getItem(`cloudbox:preferences:${user.id}`) || 'null');
    if (!saved || !['claro', 'oscuro', 'sistema'].includes(saved.theme)) return;
    previewTheme(saved.theme);
    document.documentElement.dataset.sizeUnit = saved.showKB === true ? 'KB' : 'MB';
  } catch { /* Missing or invalid cache never blocks app startup. */ }
}
