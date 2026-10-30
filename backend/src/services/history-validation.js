const invalid = message => Object.assign(new Error(message), { status: 400 });
function integer(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  if (value === undefined) return fallback;
  if (!/^(0|[1-9]\d*)$/.test(String(value)) || typeof value === 'object') throw invalid('Parámetro entero inválido');
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number > max) throw invalid('Parámetro fuera de rango');
  return number;
}
function pagination(query = {}) {
  const limit = integer(query.limit, 20, 100);
  if (!limit) throw invalid('limit debe ser mayor que cero');
  const offset = integer(query.offset, 0, Number.MAX_SAFE_INTEGER - 100);
  return { limit, offset };
}
function activityFilters(query = {}) {
  const result = pagination(query);
  for (const key of ['from', 'to']) {
    const value = query[key];
    if (value === undefined) continue;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value || value < '0001-01-01' || value > '9998-12-31') throw invalid('Fecha inválida');
    result[key] = value;
  }
  if (result.from && result.to && result.from > result.to) throw invalid('from debe ser anterior o igual a to');
  if (query.action !== undefined) {
    if (typeof query.action !== 'string' || !query.action.trim() || query.action.length > 100) throw invalid('Acción inválida');
    result.action = query.action;
  }
  return result;
}
function resourceId(value) {
  const id = integer(value, 0, 2147483647);
  if (!id) throw invalid('Identificador inválido');
  return id;
}
module.exports = { pagination, activityFilters, resourceId };
