import Loading from "../../components/Loading/Loading";
import { useEffect, useEffectEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, HardDrive, Info, RefreshCw } from "lucide-react";
import { getMyStorage } from "../../services/profileService";
import { useResource } from "../../hooks/useResource";

const formatStorage = value => {
  if (value == null) return '—';
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return '—';
  if (bytes === 0) return '0 B';
  const index = Math.min(3, Math.max(0, Math.floor(Math.log(bytes) / Math.log(1024))));
  return `${(bytes / 1024 ** index).toLocaleString('es-GT', { maximumFractionDigits: 2 })} ${['B', 'KB', 'MB', 'GB'][index]}`;
};
export default function StorageSummary({ isAdmin = false }) {
  const resource = useResource(getMyStorage);
  const refreshStorage = useEffectEvent(() => resource.refresh());
  useEffect(() => {
    const refresh = () => refreshStorage();
    window.addEventListener('cloudbox:storage-updated', refresh);
    return () => window.removeEventListener('cloudbox:storage-updated', refresh);
  }, []);
  const storage = resource.data;
  const usage = storage ? Math.min(100, Math.max(0, Number(storage.percentageUsed) || 0)) : 0;
  const capacity = storage?.maxBytes ?? (storage?.plan?.espacio_maximo_gb != null ? Number(storage.plan.espacio_maximo_gb) * 1024 ** 3 : null);
  return <section className="storageSummary account-storage" aria-labelledby="storageSummaryTitle"><div className="account-storage-heading"><div><span className="account-section-icon"><HardDrive size={20} /></span><div><h2 id="storageSummaryTitle">Tu espacio en la nube</h2><p>Un vistazo al almacenamiento de tu cuenta.</p></div></div>{storage?.plan?.nombre && <span className="storagePlanBadge">Plan {storage.plan.nombre}</span>}</div>{resource.loading && <Loading inline text="Cargando almacenamiento…" />}{resource.error && <div className="account-storage-message" role="alert"><p>{resource.error}</p><button type="button" className="secondaryButton" onClick={resource.refresh}><RefreshCw size={14} />Reintentar</button></div>}{storage && <><div className="account-storage-metrics">{[['Utilizado', formatStorage(storage.usedBytes)], ['Disponible', formatStorage(storage.availableBytes)], ['Capacidad', formatStorage(capacity)]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><div className="storageSummaryTrack" role="progressbar" aria-label="Almacenamiento usado" aria-valuemin={0} aria-valuemax={100} aria-valuenow={usage}><span className={`storageSummaryFill ${usage > 80 ? 'storageSummaryFillRed' : usage > 50 ? 'storageSummaryFillYellow' : 'storageSummaryFillBlue'}`} style={{ width: `${usage}%` }} /></div><div className="account-storage-bottom"><span><Info size={13} />{usage.toFixed(1)} % de tu espacio utilizado</span><Link to={isAdmin ? '/admin/almacenamiento' : '/plan'}>Ver {isAdmin ? 'almacenamiento' : 'mi plan'}<ArrowRight size={14} /></Link></div></>}</section>;
}
