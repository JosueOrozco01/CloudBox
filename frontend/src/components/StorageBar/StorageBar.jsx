import { formatStorageBytes, formatStoragePercent, storagePercentage } from '../../utils/storageUsage';
import './StorageBar.css';

export default function StorageBar({ usedBytes, totalBytes, percentage = 0, className = '', fillClassName = '', fillStyle, label = 'Almacenamiento utilizado' }) {
  const percent = storagePercentage(usedBytes, totalBytes, percentage);
  const bounded = Math.min(100, percent);
  const description = usedBytes != null && totalBytes > 0
    ? `${formatStorageBytes(usedBytes)} de ${formatStorageBytes(totalBytes)}; ${formatStoragePercent(percent)} utilizado`
    : `${formatStoragePercent(percent)} utilizado`;
  return <div className={`storage-meter ${className}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={bounded} aria-valuetext={description} title={description}>
    <span className={fillClassName} style={{ ...fillStyle, width: `${bounded}%`, minWidth: bounded > 0 ? '2px' : '0px' }} />
  </div>;
}
