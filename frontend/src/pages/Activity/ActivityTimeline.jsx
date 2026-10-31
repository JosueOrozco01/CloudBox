import { date } from "../../utils/moduleFormat";
import { Clock3 } from "lucide-react";
import { activityPresentation, activityTime } from "./activityPresentation";

export default function ActivityTimeline({ rows }) {
  const groups = new Map();
  rows.forEach(row => { const key = date(row.fecha); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(row); });
  return <div className="activity-timeline">{[...groups].map(([day, entries]) => <section className="activity-day" key={day} aria-label={`Actividad del ${day}`}><div className="activity-day-heading"><span>{day}</span><small>{entries.length} {entries.length === 1 ? 'registro' : 'registros'}</small></div><ol>{entries.map(row => {
    const { icon: Icon, tone, category } = activityPresentation(row);
    const time = activityTime(row.fecha);
    return <li key={row.id} className="activity-entry"><span className={`activity-entry-icon ${tone}`}><Icon size={20} strokeWidth={1.8} /></span><article className="activity-entry-card"><div className="activity-entry-top"><span>{category}</span>{time && <time dateTime={row.fecha}><Clock3 size={12} />{time}</time>}</div><h3>{row.accion?.nombre || 'Actividad registrada'}</h3><p>{row.descripcion || 'Sin descripción adicional.'}</p>{row.accion?.nombre === 'Descargar archivo' && <span className="activity-download-note"><span className="activity-small-dot" aria-hidden="true" />Acceso de descarga autorizado</span>}</article></li>;
  })}</ol></section>)}</div>;
}
