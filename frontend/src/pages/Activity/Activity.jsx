import { useState } from "react";
import { Link } from "react-router-dom";
import { Activity as ActivityIcon, ArrowRight, Bell, CalendarDays, Check, Clock3, Download, Filter, FolderOpen, History, Search, Share2, Upload, X } from "lucide-react";
import { getActivity } from "../../services/activityService";
import { useResource } from "../../hooks/useResource";
import { date } from "../../utils/moduleFormat";
import { ModulePage, Feedback, Refresh, Pager } from "../../components/ModuleUI/ModuleUI";
import ActivityTimeline from "./ActivityTimeline";
import { activityActions } from "./activityPresentation";
import "./Activity.css";

const emptyFilters = { from: "", to: "", action: "" };
const quickFilters = [["", "Todo", History], ["Subir archivo", "Subidas", Upload], ["Descargar archivo", "Descargas", Download], ["Compartir archivo", "Archivos compartidos", Share2]];

export default function Activity() {
  const [filters, setFilters] = useState(emptyFilters);
  const [applied, setApplied] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const resource = useResource(() => getActivity({ ...applied, limit: 20, offset: (page - 1) * 20 }), [applied, page]);
  const rows = resource.data || [];
  const loaded = resource.data !== null;
  const normalize = value => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const filtered = rows.filter(row => normalize(`${row.accion?.nombre || ""} ${row.descripcion || ""}`).includes(normalize(search.trim())));
  const pending = Object.keys(filters).some(key => filters[key] !== applied[key]);
  const hasFilters = Boolean(applied.from || applied.to || applied.action || search);
  const reset = () => { setFilters(emptyFilters); setApplied(emptyFilters); setSearch(""); setPage(1); };
  const chooseAction = action => { const next = { ...applied, action }; setFilters(next); setApplied(next); setSearch(""); setPage(1); };
  const count = names => rows.filter(row => names.includes(row.accion?.nombre)).length;

  return <ModulePage loading={resource.loading} title="Mi actividad" description="El recorrido de tus archivos, paso a paso." actions={<><Link className="module-button" to="/notificaciones"><Bell size={15} />Notificaciones</Link><Refresh onClick={resource.refresh} busy={resource.loading} /></>}>
    <section className="activity-hero" aria-labelledby="activity-hero-title"><div><span className="activity-eyebrow"><History size={16} />TU HISTORIAL PERSONAL</span><h2 id="activity-hero-title">Cada archivo tiene una historia.<br /><span>Aquí puedes seguir la tuya.</span></h2><p>Encuentra tus subidas, descargas y archivos compartidos en un solo recorrido.</p></div><div className="activity-hero-art" aria-hidden="true"><span className="activity-orbit" /><span className="activity-art-icon"><ActivityIcon size={48} strokeWidth={1.4} /></span><span className="activity-art-point activity-art-upload"><Upload size={18} /></span><span className="activity-art-point activity-art-share"><Share2 size={18} /></span><span className="activity-art-caption"><Clock3 size={12} />Tu espacio, en movimiento</span></div></section>
    <Feedback error={resource.error} />
    <section className="activity-filter-panel" aria-labelledby="activity-filter-title"><div className="activity-filter-heading"><span><Filter size={16} /><h2 id="activity-filter-title">Encuentra ese momento</h2></span><p>{pending ? 'Tienes filtros pendientes de aplicar' : 'Filtra por fecha y tipo de acción'}</p></div><form className="activity-filter-form" onSubmit={event => { event.preventDefault(); setPage(1); setApplied({ ...filters }); setSearch(""); }}>{['from', 'to'].map(key => <label className="module-field" key={key}>{key === 'from' ? 'Desde' : 'Hasta'}<input type="date" value={filters[key]} min={key === 'to' ? filters.from || undefined : undefined} max={key === 'from' ? filters.to || undefined : undefined} onChange={event => setFilters({ ...filters, [key]: event.target.value })} /></label>)}<label className="module-field activity-action-field">Acción<select value={filters.action} onChange={event => setFilters({ ...filters, action: event.target.value })}><option value="">Todas las acciones</option>{activityActions.map(action => <option key={action}>{action}</option>)}</select></label><button className="module-button primary"><Filter size={15} />Aplicar filtros</button>{(hasFilters || pending) && <button type="button" className="activity-clear" onClick={reset}>Limpiar<X size={13} /></button>}</form></section>
    <div className="activity-layout"><section className="activity-feed" aria-labelledby="activity-feed-title"><div className="activity-feed-heading"><div><span className="activity-kicker">LO QUE HAS HECHO EN CLOUDBOX</span><h2 id="activity-feed-title">Tu línea de tiempo</h2><p>{applied.from || applied.to ? `${applied.from ? date(applied.from) : 'Desde el inicio'} — ${applied.to ? date(applied.to) : 'Hasta hoy'}` : 'Consulta las acciones registradas en tu cuenta.'}</p></div><span className="activity-result-count" role="status">{loaded ? filtered.length : '—'} {filtered.length === 1 ? 'registro' : 'registros'} en esta página</span></div>
      <div className="activity-quick-filters" role="group" aria-label="Filtrar acciones rápidamente">{quickFilters.map(([action, label, Icon]) => <button type="button" key={label} aria-pressed={applied.action === action} className={applied.action === action ? 'active' : ''} onClick={() => chooseAction(action)}><Icon size={14} />{label}</button>)}</div>
      <label className="activity-search"><Search size={17} /><span className="activity-sr-only">Buscar actividad en esta página</span><input type="search" placeholder="Buscar en los registros de esta página…" value={search} onChange={event => setSearch(event.target.value)} />{search && <button type="button" aria-label="Limpiar búsqueda de actividad" onClick={() => setSearch("")}><X size={15} /></button>}</label>
      
      {!resource.loading && !resource.error && !filtered.length && <div className="activity-empty"><span><History size={34} strokeWidth={1.5} /></span><h3>{hasFilters ? 'Busquemos en otro momento' : 'Tu historia empieza aquí'}</h3><p>No hay registros para mostrar en esta consulta.{hasFilters ? ' Cambia las fechas, la acción o las palabras de búsqueda.' : ' Las próximas acciones registradas aparecerán en tu historial.'}</p>{hasFilters && <button className="module-button" onClick={reset}>Ver toda mi actividad</button>}</div>}
      <ActivityTimeline rows={filtered} /><Pager page={page} onChange={setPage} hasNext={rows.length === 20} busy={resource.loading} />
    </section><aside className="activity-sidebar"><section className="activity-page-summary"><span className="activity-sidebar-icon"><ActivityIcon size={23} /></span><h2>Esta parte de tu historia</h2><p>Un resumen de los registros de esta página.</p><div className="activity-page-total"><strong>{loaded ? rows.length : '—'}</strong><span>acciones registradas</span></div>{[[Upload, 'Subidas', count(['Subir archivo'])], [Download, 'Descargas', count(['Descargar archivo'])], [Share2, 'Compartidos', count(['Compartir archivo', 'Compartir carpeta'])]].map(([Icon, label, value]) => <div className="activity-summary-row" key={label}><span><Icon size={14} />{label}</span><strong>{loaded ? value : '—'}</strong></div>)}<small>Hasta 20 registros por página.</small></section><section className="activity-download-help"><Download size={23} /><h2>Sobre tus descargas</h2><p>El historial registra cuándo se autoriza el acceso. No confirma que el navegador haya recibido el archivo completo.</p><span><Check size={13} />Información de tu actividad</span></section><Link className="activity-files-link" to="/archivos"><span><FolderOpen size={21} /></span><div><strong>Vuelve a tus archivos</strong><p>Sigue con lo que estabas creando.</p></div><ArrowRight size={16} /></Link></aside></div>
    <div className="activity-footer-note"><CalendarDays size={15} /><p>Los filtros por fecha consultan días en UTC. Las horas de cada registro se muestran en la zona horaria de tu navegador.</p></div>
  </ModulePage>;
}
