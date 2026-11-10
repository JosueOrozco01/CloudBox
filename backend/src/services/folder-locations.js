// Only folders reachable from the root can be selected as destinations.
function buildFolderLocations(folders) {
  const children = new Map();
  for (const folder of folders) {
    const parent = folder.id_padre == null ? null : String(folder.id_padre);
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(folder);
  }
  for (const siblings of children.values()) siblings.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const pending = [...(children.get(null) || [])].reverse().map(folder => ({ folder, prefix: '' }));
  const visited = new Set();
  const locations = [];
  while (pending.length) {
    const { folder, prefix } = pending.pop();
    const id = String(folder.id);
    if (visited.has(id)) continue;
    visited.add(id);
    const name = prefix + folder.nombre;
    locations.push({ id: folder.id, name });
    for (const child of [...(children.get(id) || [])].reverse()) pending.push({ folder: child, prefix: `${name} / ` });
  }
  return locations;
}
module.exports = { buildFolderLocations };
