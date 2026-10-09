export function matchesFileFilters(
  item,
  { query = "", tab = "todos", type = "", date = "", size = "" } = {},
  now = Date.now(),
) {
  if (
    (tab === "archivos" && item.type === "carpeta") ||
    (tab === "carpetas" && item.type !== "carpeta")
  )
    return false;
  if (type && item.type !== type) return false;
  if (
    date &&
    (!item.timestamp ||
      new Date(item.timestamp).getTime() < now - Number(date) * 86400000)
  )
    return false;
  if (size && item.type === "carpeta") return false;
  if (
    (size === "small" && item.bytes >= 1024 ** 2) ||
    (size === "medium" &&
      (item.bytes < 1024 ** 2 || item.bytes > 10 * 1024 ** 2)) ||
    (size === "large" && item.bytes <= 10 * 1024 ** 2)
  )
    return false;
  return item.name.toLocaleLowerCase().includes(query.toLocaleLowerCase());
}

export function reorderItems(items, sourceId, targetId) {
  const from = items.findIndex((item) => item.id === sourceId);
  const to = items.findIndex((item) => item.id === targetId);
  if (from < 0 || to < 0) return items;
  const result = [...items];
  const [item] = result.splice(from, 1);
  result.splice(to, 0, item);
  return result;
}
