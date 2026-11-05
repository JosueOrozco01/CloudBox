export function storagePercentage(usedBytes, totalBytes, fallback = 0) {
  const used = Number(usedBytes);
  const total = Number(totalBytes);
  if (usedBytes != null && totalBytes != null && Number.isFinite(used) && used >= 0 && Number.isFinite(total) && total > 0) {
    return used / total * 100;
  }
  const percentage = Number(fallback);
  return Number.isFinite(percentage) ? Math.max(0, percentage) : 0;
}

export function formatStorageBytes(value) {
  if (value == null || !Number.isFinite(Number(value)) || Number(value) < 0) return '—';
  const bytes = Number(value);
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(units.length - 1, Math.max(0, Math.floor(Math.log(bytes) / Math.log(1024))));
  return `${(bytes / 1024 ** index).toLocaleString('es-GT', { maximumFractionDigits: 2 })} ${units[index]}`;
}

export function formatStoragePercent(value) {
  const percent = Number(value);
  if (!Number.isFinite(percent) || percent < 0) return '—';
  if (percent > 0 && percent < 0.1) return '<0.1 %';
  return `${percent.toLocaleString('es-GT', { maximumFractionDigits: 1 })} %`;
}
