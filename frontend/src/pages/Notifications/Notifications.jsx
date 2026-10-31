import { date } from "../../utils/moduleFormat";
import { useResource } from "../../hooks/useResource";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowRight, Bell, BellRing, CheckCheck, Inbox, Search, Settings2, Trash2, X } from "lucide-react";
import { getNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification } from "../../services/notificationService";
import { ModulePage, Feedback, Refresh, Pager, Modal } from "../../components/ModuleUI/ModuleUI";
import NotificationCard from "./NotificationCard";
import { notificationPresentation, notificationDestination } from "./notificationPresentation";
import "./Notifications.css";

export default function Notifications() {
  const [unread, setUnread] = useState(false);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [remove, setRemove] = useState(null);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const resource = useResource(() => getNotifications({ unread, limit: 20, offset: (page - 1) * 20 }), [unread, page]);
  const mutate = async (path, method = "PATCH") => {
    if (busy) return false;
    setBusy(true); setError("");
    try {
      await (method === "DELETE" ? deleteNotification(path) : path === "read-all" ? markAllNotificationsRead() : markNotificationRead(path.split("/")[0]));
      setRemove(null); resource.refresh(); window.dispatchEvent(new Event("notifications-changed"));
      return true;
    } catch (err) { setError(err.message); return false; }
    finally { setBusy(false); }
  };
  const openDetail = async row => {
    if (busy) return;
    if (row.leida || await mutate(`${row.id}/read`)) setSelected({ ...row, leida: true });
  };
  const rows = resource.data || [];
  const unreadCount = rows.filter(row => !row.leida).length;
  const loaded = resource.data !== null;
  const normalize = value => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const filtered = rows.filter(row => (category === "all" || notificationPresentation(row).category === category) && normalize(`${row.titulo || ""} ${row.mensaje || ""}`).includes(normalize(search.trim())));
  const groups = new Map();
  filtered.forEach(row => { const key = date(row.fecha_creacion); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(row); });
  const selectedPresentation = selected ? notificationPresentation(selected) : null;
  const reset = () => { setSearch(""); setCategory("all"); setUnread(false); setPage(1); };

  return <ModulePage loading={resource.loading} title="Notificaciones" description="Todo lo que pasa en tu espacio, sin perderte un detalle." actions={<><button className="module-button primary" disabled={busy || resource.loading} onClick={() => mutate("read-all")}><CheckCheck size={16} />Marcar todas como leídas</button><Refresh onClick={resource.refresh} busy={resource.loading} /></>}>
    <Feedback error={error || resource.error} />
    <section className="notifications-hero" aria-labelledby="notifications-hero-title"><div className="notifications-hero-copy"><span className="notifications-eyebrow"><BellRing size={16} />TU BANDEJA PERSONAL</span><h2 id="notifications-hero-title">Tu espacio se mueve.<br /><span>Aquí están las novedades.</span></h2><p>Archivos compartidos, pagos y avisos de tu cuenta. Todo en un solo lugar.</p></div><div className="notifications-hero-summary"><div className="notifications-hero-bell" aria-hidden="true"><Bell size={42} strokeWidth={1.4} /><span /></div><div><strong>{loaded ? unreadCount : '—'}</strong><span>sin leer en esta página</span></div></div></section>
    <div className="notifications-layout"><section className="notifications-feed" aria-labelledby="notifications-feed-title"><div className="notifications-feed-heading"><div><h2 id="notifications-feed-title">Tu bandeja</h2><p>Un vistazo a las novedades de CloudBox.</p></div><span className="notifications-count" role="status">{loaded ? filtered.length : '—'} avisos en esta página</span></div>
      <div className="notifications-toolbar"><div className="notifications-tabs" role="group" aria-label="Filtrar por lectura"><button type="button" aria-pressed={!unread} className={unread ? '' : 'active'} onClick={() => { setUnread(false); setPage(1); }}><Inbox size={15} />Todas</button><button type="button" aria-pressed={unread} className={unread ? 'active' : ''} onClick={() => { setUnread(true); setPage(1); }}><Bell size={15} />Sin leer</button></div><label className="notifications-topic"><span className="notifications-sr-only">Filtrar por tema</span><select value={category} onChange={event => setCategory(event.target.value)}><option value="all">Todos los temas</option><option value="shared">Compartidos</option><option value="plans">Pagos y planes</option><option value="storage">Almacenamiento</option><option value="other">Otros avisos</option></select></label></div>
      <label className="notifications-search"><Search size={17} /><span className="notifications-sr-only">Buscar notificaciones en esta página</span><input type="search" value={search} placeholder="Buscar en los avisos de esta página…" onChange={event => setSearch(event.target.value)} />{search && <button type="button" aria-label="Limpiar búsqueda de notificaciones" onClick={() => setSearch("")}><X size={15} /></button>}</label>
      
      {!resource.loading && !resource.error && !filtered.length && <div className="notifications-empty"><span><CheckCheck size={35} strokeWidth={1.5} /></span><h3>{search || category !== 'all' ? 'Probemos con otra búsqueda' : 'Un momento de tranquilidad'}</h3><p>No tienes notificaciones en esta vista.{search || category !== 'all' ? ' Prueba con otro tema o una palabra diferente.' : ' Tus próximos avisos aparecerán aquí.'}</p>{(search || category !== 'all' || unread || page > 1) && <button className="module-button" onClick={reset}>Ver todos los avisos</button>}</div>}
      {[...groups].map(([label, notifications]) => <div className="notifications-day" key={label}><div className="notifications-day-heading"><span>{label}</span><span>{notifications.length} {notifications.length === 1 ? 'aviso' : 'avisos'}</span></div>{notifications.map(row => <NotificationCard key={row.id} notification={row} busy={busy} onRead={() => mutate(`${row.id}/read`)} onDelete={() => { setError(""); setRemove(row); }} onDetail={() => openDetail(row)} />)}</div>)}
      <Pager page={page} onChange={setPage} hasNext={rows.length === 20} busy={resource.loading || busy} />
    </section><aside className="notifications-sidebar"><section className="notifications-status"><span className="notifications-sidebar-icon"><CheckCheck size={22} /></span><h2>Un poco más de orden</h2><p>Marca tus avisos como leídos y vuelve a lo que importa.</p><div><span><i />Sin leer</span><strong>{loaded ? unreadCount : '—'}</strong></div><div><span><CheckCheck size={13} />Leídos</span><strong>{loaded ? rows.length - unreadCount : '—'}</strong></div><small>Resumen de esta página · hasta 20 avisos</small></section><section className="notifications-activity"><Activity size={24} /><h2>Cada acción tiene su historia</h2><p>Consulta las acciones registradas en tu cuenta y encuentra lo que has hecho.</p><Link to="/actividad">Ver mi actividad<ArrowRight size={15} /></Link></section><Link className="notifications-preferences" to="/perfil?tab=preferencias"><Settings2 size={20} /><span><strong>A tu manera</strong><span>Revisa tus preferencias de cuenta</span></span><ArrowRight size={15} /></Link></aside></div>
    {remove && <Modal title="Eliminar notificación" subtitle="Organiza tu bandeja de avisos" icon={Trash2} busy={busy} onClose={() => setRemove(null)}><div className="module-form"><div className="notifications-remove-preview"><Bell size={20} /><p>{remove.titulo}</p></div><p className="module-muted">¿Quieres eliminar este aviso de tu bandeja? Esta acción no elimina el archivo, pago o recurso relacionado.</p><Feedback error={error} /><div className="module-actions"><button className="module-button" disabled={busy} onClick={() => setRemove(null)}>Volver</button><button className="module-button danger" disabled={busy} onClick={() => mutate(String(remove.id), "DELETE")}>Eliminar</button></div></div></Modal>}
    {selected && <Modal title="Detalle de notificación" subtitle={selectedPresentation.label} icon={selectedPresentation.icon} onClose={() => setSelected(null)}><div className="notifications-detail"><span className={`notice-icon ${selectedPresentation.tone}`}><selectedPresentation.icon size={27} /></span><h3>{selected.titulo}</h3><time>{date(selected.fecha_creacion)} · Leída</time><p>{selected.mensaje}</p></div><div className="module-form"><div className="module-actions"><button className="module-button" onClick={() => setSelected(null)}>Cerrar</button>{notificationDestination(selected.tipo_recurso) && <Link className="module-button primary" to={notificationDestination(selected.tipo_recurso)}>Ver recurso<ArrowRight size={15} /></Link>}</div></div></Modal>}
  </ModulePage>;
}
