export const money = value => new Intl.NumberFormat('es-GT', {
  style: 'currency',
  currency: 'GTQ'
}).format(Number(value || 0));
export const date = value => value ? new Date(String(value).length === 10 ? `${value}T00:00:00` : value).toLocaleDateString('es-GT') : '—';
