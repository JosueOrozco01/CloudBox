import { Link } from "react-router-dom";
import { ArrowUpRight, Check, Eye, Trash2 } from "lucide-react";
import { date } from "../../utils/moduleFormat";
import { notificationPresentation, notificationDestination } from "./notificationPresentation";

export default function NotificationCard({ notification: row, busy, onRead, onDelete, onDetail }) {
  const { icon: Icon, label, tone } = notificationPresentation(row);
  const destination = notificationDestination(row.tipo_recurso);
  return <article className={`notice-card ${row.leida ? "" : "unread"}`}>
    <span className={`notice-icon ${tone}`}><Icon size={22} strokeWidth={1.8} /></span>
    <div className="notice-content"><div className="notice-meta"><span>{label}</span><time dateTime={row.fecha_creacion || undefined}>{date(row.fecha_creacion)}</time></div><div className="notice-title"><h3>{row.titulo}</h3>{!row.leida && <span className="notice-new">Nuevo</span>}</div><p>{row.mensaje}</p><div className="notice-actions">{destination && <Link to={destination}>Ver recurso<ArrowUpRight size={14} /></Link>}<button type="button" disabled={busy} onClick={onDetail}><Eye size={14} />Detalle</button>{!row.leida ? <button type="button" disabled={busy} onClick={onRead}><Check size={14} />Marcar leída</button> : <span className="notice-read"><Check size={13} />Leída</span>}</div></div>
    <button type="button" className="notice-delete" aria-label={`Eliminar aviso: ${row.titulo}`} title="Eliminar notificación" disabled={busy} onClick={onDelete}><Trash2 size={16} /></button>
  </article>;
}
