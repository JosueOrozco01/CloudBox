import Loading from "../Loading/Loading";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CheckCheck, CalendarDays, FileText } from "lucide-react";
import { getNotifications, markNotificationRead, markAllNotificationsRead } from "../../services/notificationService";
import { Modal } from "../ModuleUI/ModuleUI";
import "../AdminNotifications/AdminNotifications.css";
import "../AdminUserModal/AdminUserModal.css";

const date = value => value ? new Date(String(value).length === 10 ? `${value}T00:00:00` : value).toLocaleString("es-GT") : "Fecha no disponible";
const destination = type => ["archivo", "carpeta"].includes(type) ? "/compartidos" : type === "pago" ? "/pagos" : ["suscripcion", "almacenamiento"].includes(type) ? "/plan" : null;

export default function ClientNotifications({ userId }) {
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  useEffect(() => {
    let active = true, pending = false;
    const refresh = async () => {
      if (document.hidden || pending) return;
      pending = true;
      try {
        const [rows, unreadRows] = await Promise.all([getNotifications({ limit: 100 }), getNotifications({ unread: true, limit: 100 })]);
        if (active) { setNotifications(rows); setUnread(unreadRows.length); setError(""); }
      } catch {
        if (active) setError("No se pudieron actualizar las notificaciones.");
      } finally { pending = false; if (active) setLoading(false); }
    };
    refresh();
    const interval = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    window.addEventListener("notifications-changed", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false; clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("notifications-changed", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [userId, revision]);
  useEffect(() => {
    const outside = event => { if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false); };
    const escape = event => {
      if (event.key === "Escape" && open) { setOpen(false); triggerRef.current?.focus(); }
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  const markRead = async row => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      if (row) {
        if (!row.leida) await markNotificationRead(row.id);
        setSelected({ ...row, leida: true }); setOpen(false);
      } else await markAllNotificationsRead();
      window.dispatchEvent(new Event("notifications-changed"));
    } catch { setError("No se pudo marcar la notificación como leída. Inténtalo nuevamente."); }
    finally { setBusy(false); }
  };
  const closeDetail = () => { setSelected(null); triggerRef.current?.focus(); };
  return <>
    <div className="admin-notifications" ref={rootRef}>
      <button ref={triggerRef} type="button" className="app-notification-button" aria-label={`Notificaciones: ${unread >= 100 ? "100 o más" : unread} sin leer`} aria-expanded={open} aria-controls="client-notification-panel" onClick={() => setOpen(value => !value)}>
        <Bell size={20} />
        {unread > 0 && <span className="admin-notification-count">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && <section id="client-notification-panel" className="admin-notification-panel" aria-label="Notificaciones personales">
        <header><div><h2>Notificaciones recientes</h2><p>{unread ? `${unread >= 100 ? "100 o más" : unread} notificaciones sin leer` : "Estás al día"}</p></div><button type="button" title="Marcar todas como leídas" aria-label="Marcar todas como leídas" disabled={!unread || busy} onClick={() => markRead(null)}><CheckCheck size={20} /></button></header>
        {error && <p className="admin-notification-feedback" role="alert">{error} <button type="button" onClick={() => setRevision(value => value + 1)}>Reintentar</button></p>}
        {loading && <Loading inline text="Cargando notificaciones…" />}
        {!loading && !error && !notifications.length && <p className="admin-notification-feedback">No tienes notificaciones.</p>}
        <ul>{notifications.map(row => <li key={row.id}><button type="button" className={row.leida ? "" : "unread"} disabled={busy} onClick={() => markRead(row)}><span className="admin-notification-icon"><Bell size={18} /></span><span><strong>{row.titulo}</strong><span>{row.mensaje}</span><time>{date(row.fecha_creacion)}</time></span>{!row.leida && <i aria-label="Sin leer" />}</button></li>)}</ul>
        <footer><Link to="/notificaciones" onClick={() => setOpen(false)}>Ver todas las notificaciones</Link><span>Últimos 100 avisos · actualización automática</span></footer>
      </section>}
    </div>
    {selected && <Modal title="Detalle de notificación" subtitle={selected.titulo} icon={Bell} onClose={closeDetail}>
      <dl className="admin-user-details"><div><dt><CalendarDays size={15} />Fecha y hora</dt><dd>{date(selected.fecha_creacion)}</dd></div><div><dt><CheckCheck size={15} />Estado</dt><dd>Leída</dd></div><div className="client-notification-message"><dt><FileText size={15} />Mensaje</dt><dd>{selected.mensaje}</dd></div></dl>
      <div className="module-form"><div className="module-actions">{destination(selected.tipo_recurso) && <Link className="module-button" to={destination(selected.tipo_recurso)} onClick={closeDetail}>Ver recurso</Link>}<button type="button" className="module-button primary" onClick={closeDetail}>Cerrar</button></div></div>
    </Modal>}
  </>;
}
