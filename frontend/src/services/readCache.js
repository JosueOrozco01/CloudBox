// Short-lived, memory-only API cache. Account credentials are part of every key.
export function createReadCache({ now = Date.now, ttl = 5000, maxEntries = 80 } = {}) {
  const entries = new Map();
  const subscribers = new Set();
  let revision = 0;
  const invalidate = () => {
    revision++; entries.clear();
    for (const subscriber of subscribers) subscriber();
  };
  async function fetchRead(url, options = {}, fetcher) {
    const method = (options.method || 'GET').toUpperCase();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      invalidate();
      try { return await fetcher(url, options); }
      finally { invalidate(); }
    }
    const path = new URL(url, 'http://localhost').pathname;
    // Access URLs always reauthorize. Live inboxes only share in-flight reads.
    const skip = method !== 'GET' || options.signal || options.cache === 'no-store'
      || /\/auth(\/|$)|\/download(?:-url)?$|\/export$/.test(path);
    if (skip) return fetcher(url, options);
    const live = /\/(notifications|notification-reads|audit-logs)(\/|$)/.test(path);
    const headers = new Headers(options.headers);
    const key = JSON.stringify([String(url), [...headers.entries()].sort()]);
    const existing = entries.get(key);
    if (existing && existing.expires > now()) return (await existing.promise).clone();
    const startedRevision = revision;
    const entry = { expires: Infinity };
    entry.promise = Promise.resolve().then(() => fetcher(url, options)).then(response => {
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
        if (entries.get(key) === entry) entries.delete(key);
      } else if (revision === startedRevision && entries.get(key) === entry) {
        entry.expires = now() + (live ? 0 : /\/users\/me(?:\/preferences)?$/.test(path) ? 30000 : ttl);
      }
      return response;
    }).catch(error => {
      if (entries.get(key) === entry) entries.delete(key);
      throw error;
    });
    entries.delete(key);
    entries.set(key, entry);
    while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
    return (await entry.promise).clone();
  }
  return { fetch: fetchRead, invalidate, getRevision: () => revision, subscribe: listener => { subscribers.add(listener); return () => subscribers.delete(listener); } };
}

const cache = createReadCache();
export const cachedRead = cache.fetch;
export const invalidateReadCache = cache.invalidate;
export const getReadCacheRevision = cache.getRevision;
export const onReadCacheInvalidated = cache.subscribe;
if (typeof window !== 'undefined') {
  for (const event of ['cloudbox:session-changed', 'cloudbox:token-refreshed', 'profile-changed', 'cloudbox:storage-updated']) {
    window.addEventListener(event, invalidateReadCache);
  }
  window.addEventListener('storage', event => {
    if (event.key === null || ['token', 'refreshToken', 'user'].includes(event.key)) invalidateReadCache();
  });
}
