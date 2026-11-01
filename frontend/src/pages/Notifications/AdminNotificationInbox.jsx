import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellRing, CheckCheck, Inbox, Search, X, Activity, ArrowRight, ShieldCheck, CalendarDays } from 'lucide-react';
import { getAdminActivity } from '../../services/adminService';
import { activityLabel } from '../../utils/activityLabels';
import { date } from '../../utils/moduleFormat';
import { useAdminNotificationRead } from '../../hooks/useAdminNotificationRead';
import { ModulePage, Feedback, Refresh, Modal, Pager } from '../../components/ModuleUI/ModuleUI';
import NotificationCard from '../Notifications/NotificationCard';
import '../Notifications/Notifications.css';

export default function AdminNotificationInbox({ user }) {
  const [page,setPage]=useState(1);
  const [total,setTotal]=useState(0);
  const { read, markRead, error: readError } = useAdminNotificationRead(user.id,(page-1)*100);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    let active = true, pending = false;
    const refresh = async () => {
      if (pending || document.hidden) return;
      pending = true;
      try { const result = await getAdminActivity(100,(page-1)*100); if (active) { setLogs(result.logs); setTotal(result.total || 0); setError(''); } }
      catch (err) { if (active) setError(err.message || 'No se pudo actualizar la actividad.'); }
      finally { pending = false; if (active) setLoading(false); }
    };
    refresh();
    const interval = setInterval(refresh, 5000);
    window.addEventListener('focus', refresh);
    window.addEventListener('admin-activity-changed', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { active = false; clearInterval(interval); window.removeEventListener('focus', refresh); window.removeEventListener('admin-activity-changed', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [revision,page]);
  const rows = logs.map(log => ({ id: log.id, titulo: activityLabel(log), mensaje: [log.actorName || `Usuario #${log.id_usuario}`, log.targetName, log.resultDescription].filter(Boolean).join(' · '), fecha_creacion: log.fecha, leida: read.includes(log.id), log }));
  const unread = rows.filter(row => !row.leida).length;
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const filtered = rows.filter(row => (!unreadOnly || !row.leida) && normalize(`${row.titulo} ${row.mensaje}`).includes(normalize(search.trim())));
  const groups = new Map();
  filtered.forEach(row => { const key = date(row.fecha_creacion); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(row); });
  const reset = () => { setSearch(''); setUnreadOnly(false); };
  return <ModulePage loading={loading} title="Notificaciones" description="Toda la actividad administrativa de CloudBox, en un solo lugar." actions={<><button className="module-button primary" disabled={loading || !unread} onClick={() => markRead(rows.map(row => row.id))}><CheckCheck size={16} />Marcar página como leída</button><Refresh onClick={() => setRevision(value => value + 1)} busy={loading} /></>}>
    <Feedback error={error || readError} />
    <section className="notifications-hero" aria-labelledby="admin-notices-title"><div className="notifications-hero-copy"><span className="notifications-eyebrow"><BellRing size={16} />TU BANDEJA ADMINISTRATIVA</span><h2 id="admin-notices-title">Tu plataforma se mueve.<br /><span>Aquí están las novedades.</span></h2><p>Usuarios, planes y acciones registradas. Mantén el pulso de CloudBox.</p></div><div className="notifications-hero-summary"><div className="notifications-hero-bell" aria-hidden="true"><Bell size={42} strokeWidth={1.4} /><span /></div><div><strong>{unread}</strong><span>sin leer en los últimos 100 eventos</span></div></div></section>
    <div className="notifications-layout"><section className="notifications-feed" aria-labelledby="admin-notices-feed"><div className="notifications-feed-heading"><div><h2 id="admin-notices-feed">Tu bandeja</h2><p>Las novedades de administración, ordenadas por fecha.</p></div><span className="notifications-count" role="status">{filtered.length} avisos en esta vista</span></div>
      <div className="notifications-toolbar"><div className="notifications-tabs" role="group" aria-label="Filtrar por lectura"><button type="button" aria-pressed={!unreadOnly} className={!unreadOnly ? 'active' : ''} onClick={() => setUnreadOnly(false)}><Inbox size={15} />Todas</button><button type="button" aria-pressed={unreadOnly} className={unreadOnly ? 'active' : ''} onClick={() => setUnreadOnly(true)}><Bell size={15} />Sin leer</button></div></div>
      <label className="notifications-search"><Search size={17} /><span className="notifications-sr-only">Buscar en los últimos 100 eventos</span><input type="search" value={search} placeholder="Buscar por acción, usuario o elemento…" onChange={event => setSearch(event.target.value)} />{search && <button type="button" aria-label="Limpiar búsqueda" onClick={() => setSearch('')}><X size={15} /></button>}</label>
      {!error && !filtered.length && <div className="notifications-empty"><span><CheckCheck size={35} strokeWidth={1.5} /></span><h3>{search ? 'Probemos con otra búsqueda' : 'Un momento de tranquilidad'}</h3><p>No hay notificaciones en esta vista. Los próximos eventos administrativos aparecerán aquí.</p>{(search || unreadOnly) && <button className="module-button" onClick={reset}>Ver todos los avisos</button>}</div>}
      {[...groups].map(([day, notifications]) => <div className="notifications-day" key={day}><div className="notifications-day-heading"><span>{day}</span><span>{notifications.length} avisos</span></div>{notifications.map(row => <NotificationCard key={row.id} notification={row} onRead={() => markRead([row.id])} onDetail={async () => { if(await markRead([row.id])) setSelected(row); }} />)}</div>)}
    <Pager page={page} onChange={setPage} hasNext={page*100<total} busy={loading} /></section><aside className="notifications-sidebar"><section className="notifications-status"><span className="notifications-sidebar-icon"><CheckCheck size={22} /></span><h2>Un poco más de orden</h2><p>Revisa las novedades y marca los eventos que ya consultaste.</p><div><span><i />Sin leer</span><strong>{unread}</strong></div><div><span><CheckCheck size={13} />Leídos</span><strong>{rows.length - unread}</strong></div><small>Resumen de los últimos 100 eventos · actualización automática</small></section><section className="notifications-activity"><Activity size={24} /><h2>El pulso de CloudBox</h2><p>Consulta los indicadores y reportes de tu plataforma.</p><Link to="/admin/metricas">Ver métricas<ArrowRight size={15} /></Link></section><Link className="notifications-preferences" to="/admin/usuarios"><ShieldCheck size={20} /><span><strong>Gestiona los accesos</strong><span>Revisa usuarios y permisos</span></span><ArrowRight size={15} /></Link></aside></div>
    {selected && <Modal title="Detalle de notificación" subtitle="Actividad administrativa" icon={Activity} onClose={() => setSelected(null)}><div className="notifications-detail"><span className="notice-icon blue"><Activity size={27} /></span><h3>{selected.titulo}</h3><time><CalendarDays size={13} /> {selected.fecha_creacion ? new Date(selected.fecha_creacion).toLocaleString('es-GT') : 'Fecha no disponible'} · Leída</time><p>{selected.mensaje}{selected.log.entidad_afectada ? `\nElemento: ${selected.log.entidad_afectada}` : ''}</p></div><div className="module-form"><div className="module-actions"><button className="module-button primary" onClick={() => setSelected(null)}>Cerrar</button></div></div></Modal>}
  </ModulePage>;
}
