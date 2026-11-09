import { formatStorageBytes, formatStoragePercent, storagePercentage } from '../../utils/storageUsage';
import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowRight, CalendarDays, Check, Cloud, CreditCard, HardDrive } from "lucide-react";
import { date, money } from "../../utils/moduleFormat";
import { Feedback } from "../../components/ModuleUI/ModuleUI";

const gb = formatStorageBytes;

export default function PlanOverview({ data }) {
  const { current, quota, currentLoaded, plans } = data;
  const catalogPlan = plans.find(plan => plan.id === current?.planId);
  const capacity = quota?.plan_actual?.capacidad_bytes ?? (current?.capacityGb != null ? current.capacityGb * 1024 ** 3 : catalogPlan ? catalogPlan.espacio_maximo_gb * 1024 ** 3 : quota ? Number(quota.espacio_usado_bytes) + Number(quota.espacio_disponible_bytes) : null);
  const percentage = storagePercentage(quota?.espacio_usado_bytes, capacity, quota?.porcentaje_uso);
  const free = current?.price === 0;
  const planName = current?.planName || (currentLoaded ? "Sin suscripción" : "Plan no disponible");
  return <div className="plans-overview">
    <section className="plans-current" aria-labelledby="plans-current-title">
      <div className="plans-current-top"><span className="plans-current-label"><Cloud size={17} />TU ESPACIO EN CLOUDBOX</span>{current?.status && <span className="plans-current-status"><span />{current.status}</span>}</div>
      <div className="plans-current-content"><span className="plans-current-caption">Tu plan actual</span><h2 id="plans-current-title">{planName}<span><Cloud size={56} strokeWidth={1.2} /></span></h2><p>{current ? free ? 'Todo empieza con un espacio para ti.' : 'Un lugar para tus ideas, tus proyectos y lo que viene.' : 'Elige un plan y encuentra tu espacio en la nube.'}</p></div>
      <div className="plans-current-details"><div><span><HardDrive size={14} />Capacidad</span><strong>{capacity == null ? '—' : gb(capacity)}</strong></div><div><span><CalendarDays size={14} />{free ? 'Vigencia' : 'Vigente hasta'}</span><strong>{free ? 'Sin vencimiento' : date(current?.endDate)}</strong></div><div><span><CreditCard size={14} />Precio del plan</span><strong>{current ? money(current.price) : '—'}{current?.price > 0 && catalogPlan?.vigencia_dias && <small> / {catalogPlan.vigencia_dias} días</small>}</strong></div></div>
      <div className="plans-current-footer"><a className="module-button plans-hero-button" href="#plans-catalog">Explorar planes<ArrowRight size={16} /></a><Link to="/pagos">Mis pagos<ArrowRight size={14} /></Link></div>
    </section>
    <section className="plans-storage" aria-labelledby="plans-storage-title"><div className="plans-storage-header"><span className="plans-storage-icon"><HardDrive size={19} /></span><div><h2 id="plans-storage-title">Tu almacenamiento</h2><p>Cada archivo tiene su lugar.</p></div>{quota && <span className={`plans-usage-tag ${percentage >= 90 ? 'warning' : ''}`}>{percentage >= 100 ? 'Espacio lleno' : percentage >= 90 ? 'Casi lleno' : 'Tu espacio'}</span>}</div>
      {quota ? <><div className="plans-storage-body"><div className={`plans-storage-ring ${percentage >= 90 ? 'warning' : ''}`} style={{ '--usage-angle': `${percentage > 0 ? Math.max(2, Math.min(100, percentage) * 3.6) : 0}deg` }} role="progressbar" aria-label="Almacenamiento utilizado" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, percentage)} aria-valuetext={`${formatStoragePercent(percentage)} utilizado`}><div><strong>{formatStoragePercent(percentage).replace(' %','')}<small>%</small></strong><span>utilizado</span></div></div><div className="plans-storage-numbers"><strong>{gb(quota.espacio_usado_bytes)}</strong><span>de {capacity == null ? '—' : gb(capacity)} utilizados</span><div><span /><p>{gb(quota.espacio_disponible_bytes)} disponibles</p></div></div></div><div className="plans-storage-footer"><Check size={15} /><p>{percentage >= 90 ? 'Puedes liberar espacio o ampliar tu plan.' : 'Tus archivos, siempre a tu alcance.'}</p><Link to="/archivos" aria-label="Ir a mis archivos"><ArrowDownRight size={18} /></Link></div>{quota.bloqueo_subida && <Feedback error="Tu espacio está lleno. Libera almacenamiento o cambia de plan para seguir subiendo archivos." />}</> : <div className="plans-storage-unavailable"><HardDrive size={30} /><p>No se pudo consultar el espacio disponible. Actualiza para volver a intentarlo.</p></div>}
    </section>
  </div>;
}
