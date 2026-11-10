import StorageBar from '../../components/StorageBar/StorageBar';
import { formatStorageBytes, formatStoragePercent, storagePercentage } from '../../utils/storageUsage';
import Loading from "../../components/Loading/Loading";
import { useEffect, useEffectEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, HardDrive, Info, RefreshCw } from "lucide-react";
import { getMyStorage } from "../../services/profileService";
import { useResource } from "../../hooks/useResource";

export default function StorageSummary({ isAdmin = false }) {
  const resource = useResource(getMyStorage);
  const refreshStorage = useEffectEvent(() => resource.refresh());
  useEffect(() => {
    const refresh = () => refreshStorage();
    window.addEventListener('cloudbox:storage-updated', refresh);
    return () => window.removeEventListener('cloudbox:storage-updated', refresh);
  }, []);
  const storage = resource.data;
  const capacity = storage?.maxBytes ?? (storage?.plan?.espacio_maximo_gb != null ? Number(storage.plan.espacio_maximo_gb) * 1024 ** 3 : null);
  const usage = storagePercentage(storage?.usedBytes, capacity, storage?.percentageUsed);
  return <section className="storageSummary account-storage" aria-labelledby="storageSummaryTitle"><div className="account-storage-heading"><div><span className="account-section-icon"><HardDrive size={20} /></span><div><h2 id="storageSummaryTitle">Tu espacio en la nube</h2><p>Un vistazo al almacenamiento de tu cuenta.</p></div></div>{storage?.plan?.nombre && <span className="storagePlanBadge">Plan {storage.plan.nombre}</span>}</div>{resource.loading && <Loading inline text="Cargando almacenamiento…" />}{resource.error && <div className="account-storage-message" role="alert"><p>{resource.error}</p><button type="button" className="secondaryButton" onClick={resource.refresh}><RefreshCw size={14} />Reintentar</button></div>}{storage && <><div className="account-storage-metrics">{[['Utilizado', formatStorageBytes(storage.usedBytes)], ['Disponible', formatStorageBytes(storage.availableBytes)], ['Capacidad', formatStorageBytes(capacity)]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><StorageBar className="storageSummaryTrack" fillClassName={`storageSummaryFill ${usage >= 100 ? 'storageSummaryFillRed' : usage >= 90 ? 'storageSummaryFillYellow' : 'storageSummaryFillBlue'}`} usedBytes={storage.usedBytes} totalBytes={capacity} percentage={usage} /><div className="account-storage-bottom"><span><Info size={13} />{formatStoragePercent(usage)} de tu espacio utilizado</span><Link to={isAdmin ? '/admin/almacenamiento' : '/plan'}>Ver {isAdmin ? 'almacenamiento' : 'mi plan'}<ArrowRight size={14} /></Link></div></>}</section>;
}
