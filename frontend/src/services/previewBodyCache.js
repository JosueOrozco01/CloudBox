import { readPreviewBody } from '../utils/filePreview';
import { getReadCacheRevision, onReadCacheInvalidated } from './readCache';

const bodies = new Map();
const MAX_BYTES = 20 * 1024 * 1024;
let bytes = 0;
let owner;
let revision;
onReadCacheInvalidated(() => { bodies.clear(); bytes = 0; });
function synchronize() {
  const token = localStorage.getItem('token');
  const nextRevision = getReadCacheRevision();
  if (owner !== token || revision !== nextRevision) {
    bodies.clear(); bytes = 0; owner = token; revision = nextRevision;
  }
}
export async function getPreviewBody(item, source, limit, signal) {
  synchronize();
  const expectedOwner = owner, expectedRevision = revision;
  // Only reuse bytes after fresh authorization and a server-provided file version.
  const key = source.modifiedAt ? JSON.stringify([item.rawId, item.name, source.modifiedAt, source.size]) : null;
  const cached = key && bodies.get(key);
  if (cached && cached.expires > Date.now() && cached.blob.size <= limit) return cached.blob;
  const response = await fetch(source.url, { signal });
  if (!response.ok) throw new Error('No se pudo obtener el archivo. Cierra y vuelve a abrirlo para intentarlo otra vez.');
  const blob = await readPreviewBody(response, limit);
  synchronize();
  if (key && !signal?.aborted && owner === expectedOwner && revision === expectedRevision) {
    if (bodies.has(key)) { bytes -= bodies.get(key).blob.size; bodies.delete(key); }
    bodies.set(key, { blob, expires: Date.now() + 30000 }); bytes += blob.size;
    while (bytes > MAX_BYTES || bodies.size > 8) {
      const oldest = bodies.keys().next().value;
      bytes -= bodies.get(oldest).blob.size; bodies.delete(oldest);
    }
  }
  return blob;
}
