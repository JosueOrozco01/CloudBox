import { ArrowRight, FileText, FolderOpen, Inbox, Search, Share2, ShieldCheck, Star, Users, X } from "lucide-react";
import { favoriteKey } from "../../services/favoriteService";
import ViewToggle from "../../components/ViewToggle/ViewToggle";
import { useState } from "react";
import "./Compartidoconmigo.css";
import "./SharedRefresh.css";

const icon = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

const typeStyles = {
  carpeta: { bg: "#e0e7ff", color: "#4f46e5" },
  pdf: { bg: "#fee2e2", color: "#ef4444" },
  docx: { bg: "#dbeafe", color: "#1565c0" },
  pptx: { bg: "#fef3c7", color: "#b98900" },
  zip: { bg: "#f1f5f9", color: "#475569" },
  png: { bg: "#fce7f3", color: "#db2777" },
};

const typeIcons = {
  carpeta: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  pdf: <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6" />,
  docx: <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M9 13h6 M9 17h6" />,
  pptx: <path d="M3 3h18v14H3z M8 21h8 M12 17v4" />,
  zip: <path d="M20 10v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9 M3 6h18l-1.5-3h-15z" />,
  png: (
    <>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
    </>
  ),
};

function TypeIcon({ type }) {
  const style = typeStyles[type] ?? typeStyles.docx;
  return (
    <span className="sc-type-icon" data-type={type} style={{ background: style.bg, color: style.color }}>
      <svg {...icon}>{typeIcons[type] ?? typeIcons.docx}</svg>
    </span>
  );
}

const permissionStyles = {
  Editor: { bg: "#dbeafe", color: "#1565c0" },
  Visualizador: { bg: "#dcfce7", color: "#16a34a" },
  Propietario: { bg: "#f3e8ff", color: "#9333ea" },
};

function PermissionBadge({ permission }) {
  const style = permissionStyles[permission] ?? { bg: "#f1f5f9", color: "#64748b" };
  return (
    <span className="sc-badge" data-permission={permission} style={{ background: style.bg, color: style.color }}>
      {permission}
    </span>
  );
}

export default function CompartidosConmigo({
  favoriteKeys = [],
  favoritePending = [],
  favoriteAvailability = {},
  onToggleFavorite,
  items = [],
  sent = false,
  insideFolder = false,
  totalCount = 0,
  folderCount = 0,
  fileCount = 0,
  sharedByCount = 0,
  onSearch,
  onOpenItem,
  onDownloadItem,
  onItemInfo,
}) {
  const [filters, setFilters] = useState({});
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("todos");
  const [view, setView] = useState("list");

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    onSearch?.(query);
  };

  const matched = items.filter(item =>
    (tab === 'todos' || (tab === 'carpetas') === (item.type === 'carpeta')) &&
    item.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()) &&
    Object.entries(filters).every(([key, value]) => !value || String(item[key]) === value)
  ).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  const totalPages = Math.max(1, Math.ceil(matched.length / 10));
  const currentPage = Math.min(page, totalPages);
  const filteredItems = matched.slice((currentPage - 1) * 10, currentPage * 10);
  const onPageChange = setPage;

  return (
    <div className="sc-page">
      {/* Encabezado */}
      <div className="sc-header">
        <div>
          <h1>{sent ? "Compartidos por mí" : "Compartidos conmigo"}</h1>
          <p>{sent ? "Administra los accesos que has otorgado a otros usuarios" : "Accede a los archivos y carpetas que otros usuarios han compartido contigo"}</p>
        </div>

      </div>
      <section className="sc-share-hero" aria-labelledby="sc-share-hero-title"><div><span className="sc-share-eyebrow"><Share2 size={16} />TU ESPACIO PARA COLABORAR</span><h2 id="sc-share-hero-title">{sent ? <>Tus archivos, más allá de ti.<br /><span>Comparte lo que importa.</span></> : <>Las mejores ideas se comparten.<br /><span>Aquí empieza el trabajo en equipo.</span></>}</h2><p>{sent ? 'Consulta los recursos que compartiste y administra sus permisos desde un solo lugar.' : 'Encuentra los archivos que te compartieron, guárdalos en favoritos y sigue creando.'}</p><span className="sc-share-hero-note"><ShieldCheck size={14} />{sent ? 'Tú decides quién tiene acceso' : 'Acceso según los permisos que recibiste'}</span></div><div className="sc-share-art" aria-hidden="true"><span className="sc-share-orbit" /><span className="sc-share-folder"><FolderOpen size={58} strokeWidth={1.3} /></span><span className="sc-share-person sc-share-person-one">A</span><span className="sc-share-person sc-share-person-two">M</span><span className="sc-share-art-label"><Users size={13} />Un espacio para conectar</span></div></section>
      <div className="sc-share-stats">
        {[[Inbox, sent ? 'Recursos compartidos por ti' : 'Recursos compartidos contigo', totalCount, insideFolder ? 'Acceso heredado de la carpeta' : `${sharedByCount} ${sharedByCount === 1 ? 'persona' : 'personas'} en esta vista`, 'todos', 'blue'], [FolderOpen, 'Carpetas', folderCount, 'Proyectos y archivos organizados', 'carpetas', 'violet'], [FileText, 'Archivos', fileCount, sent ? 'Recursos que has compartido' : 'Archivos compartidos contigo', 'archivos', 'cyan']].map(([Icon, label, value, hint, target, tone]) => <button type="button" className="sc-share-stat" key={target} onClick={() => { setTab(target); setFilters({}); setQuery(''); setPage(1); }}><span className={`sc-share-stat-icon ${tone}`}><Icon size={22} strokeWidth={1.8} /></span><span><span className="sc-share-stat-label">{label}</span><strong>{value}</strong><small>{hint}</small></span><ArrowRight size={15} className="sc-share-stat-arrow" /></button>)}
      </div>
      <div className="sc-resources-heading"><div><span className="sc-resources-kicker">TODO LISTO PARA COLABORAR</span><h2>{sent ? 'Lo que compartiste' : 'Compartido contigo'}</h2><p>{sent ? 'Revisa destinatarios, permisos y detalles de cada recurso.' : 'Abre una carpeta o encuentra ese archivo que necesitabas.'}</p></div><span className="sc-match-count" role="status">{matched.length} {matched.length === 1 ? 'recurso' : 'recursos'}</span></div>
      <div className="sc-share-discovery"><div className="sc-tabs" role="group" aria-label="Filtrar recursos compartidos">{[['todos', 'Todos', Inbox], ['archivos', 'Archivos', FileText], ['carpetas', 'Carpetas', FolderOpen]].map(([id, label, Icon]) => <button type="button" key={id} className={tab === id ? 'active' : ''} aria-pressed={tab === id} onClick={() => { setTab(id); setPage(1); }}><Icon size={15} />{label}</button>)}</div><form className="sc-search" onSubmit={handleSearchSubmit}><span className="sc-search-icon"><Search size={17} /></span><label className="sc-share-sr-only" htmlFor="sc-shared-search">Buscar en compartidos</label><input id="sc-shared-search" type="search" placeholder="Buscar archivos o carpetas…" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} />{query && <button type="button" className="sc-search-clear" aria-label="Limpiar búsqueda de compartidos" onClick={() => { setQuery(''); setPage(1); }}><X size={15} /></button>}</form></div>

      {/* Filtros */}
      <div className="sc-toolbar">
        <div className="sc-filters">
          {[["owner", sent ? "Destinatario" : "Propietario"], ["typeLabel", "Tipo de archivo"], ["permission", "Permiso"], ["sharedOn", "Fecha"]].map(([key, label]) => (
            <select className="sc-filter-btn" key={key} aria-label={label} value={filters[key] || ""} onChange={e => { setFilters({ ...filters, [key]: e.target.value }); setPage(1); }}>
              <option value="">{label}: todos</option>
              {[...new Set(items.map(item => item[key]))].map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          ))}
        </div>

        <div className="sc-toolbar-right">
          {(query || Object.values(filters).some(Boolean)) && <button type="button" className="sc-reset-filters" onClick={() => { setQuery(''); setFilters({}); setPage(1); }}>Limpiar<X size={13} /></button>}
          <select aria-label="Ordenar por" value={sort} onChange={e => setSort(e.target.value)}><option value="recent">Más reciente</option><option value="name">Nombre</option></select>

          <ViewToggle value={view} onChange={setView} />
        </div>
      </div>

      {/* Tabla */}
      <div className={`sc-table-wrap ${view === "grid" ? "sc-grid" : ""}`}>
        <table className="sc-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>{sent ? "Destinatario" : "Propietario"}</th>
              <th>Tipo</th>
              <th>Compartido el</th>
              <th>Permiso</th>
              <th className="sc-th-actions">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {!filteredItems.length && <tr className="sc-empty-row"><td colSpan={6}><div className="sc-share-empty"><span><Share2 size={33} strokeWidth={1.5} /></span><h3>{query || Object.values(filters).some(Boolean) || tab !== 'todos' ? 'Probemos con otra búsqueda' : sent ? 'Comparte tu primera idea' : 'Aquí hay espacio para colaborar'}</h3><p>No hay elementos compartidos que coincidan.{query || Object.values(filters).some(Boolean) || tab !== 'todos' ? ' Prueba con otro nombre o ajusta los filtros.' : sent ? ' Usa Compartir para dar acceso a tus archivos o carpetas.' : ' Los archivos y carpetas que te compartan aparecerán aquí.'}</p>{(query || Object.values(filters).some(Boolean) || tab !== 'todos') && <button type="button" className="sc-open-btn" onClick={() => { setQuery(''); setFilters({}); setTab('todos'); setPage(1); }}>Ver todos los recursos</button>}</div></td></tr>}
            {filteredItems.map((item) => (
              <tr key={item.id}>
                <td>
                  <div className="sc-name-cell">
                    <TypeIcon type={item.type} />
                    <div className="sc-resource-name"><button type="button" onClick={() => onOpenItem?.(item)}>{item.name}</button><span>{item.type === 'carpeta' ? 'Carpeta compartida' : `${item.typeLabel} · Archivo compartido`}</span></div>
                  </div>
                </td>
                <td>
                  <div className="sc-owner-cell">
                    <span className="sc-owner-avatar">{item.owner.charAt(0).toUpperCase()}</span>
                    {item.owner}
                  </div>
                </td>
                <td className="sc-muted">{item.typeLabel}</td>
                <td className="sc-muted">{item.sharedOn}</td>
                <td><PermissionBadge permission={item.permission} /></td>
                <td>
                  <div className="sc-actions">
                    {item.type !== "carpeta" && <button type="button" className={`sc-icon-btn ${favoriteKeys.includes(favoriteKey(item)) ? "sc-favorite" : ""}`} aria-pressed={favoriteKeys.includes(favoriteKey(item))} title={favoriteKeys.includes(favoriteKey(item)) ? "Quitar de favoritos" : "Agregar a favoritos"} aria-label={`${favoriteKeys.includes(favoriteKey(item)) ? "Quitar de" : "Agregar a"} favoritos: ${item.name}`} disabled={favoritePending.includes(favoriteKey(item)) || !(item.type === "carpeta" ? favoriteAvailability.folders : favoriteAvailability.files)} onClick={() => onToggleFavorite(item)}><Star size={16} fill={favoriteKeys.includes(favoriteKey(item)) ? "currentColor" : "none"} /></button>}
                    <button type="button" className="sc-open-btn" onClick={() => onOpenItem?.(item)}>
                      Abrir
                    </button>
                    <button
                      type="button"
                      className="sc-icon-btn"
                      aria-label="Descargar"
                      disabled={item.type === "carpeta"}
                      onClick={() => onDownloadItem?.(item)}
                    >
                      <svg {...icon} width="15" height="15">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="sc-icon-btn"
                      aria-label="Información"
                      onClick={() => onItemInfo?.(item)}
                    >
                      <svg {...icon} width="15" height="15">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4 M12 8h.01" />
                      </svg>
                    </button>
                    <button type="button" className="sc-icon-btn" aria-label="Más opciones" onClick={() => onItemInfo?.(item)}>
                      <svg {...icon} width="15" height="15">
                        <path d="M3 12h18 M3 6h18 M3 18h18" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="sc-pagination">
        <p>
          Mostrando <strong>{matched.length ? (currentPage - 1) * 10 + 1 : 0} a {Math.min(currentPage * 10, matched.length)}</strong> de {matched.length} elementos compartidos
        </p>

        <div className="sc-pagination-controls">
          <button
            type="button"
            className="sc-page-arrow"
            onClick={() => onPageChange?.(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label="Página anterior"
          >
            <svg {...icon} width="14" height="14">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              type="button"
              className={`sc-page-number ${page === currentPage ? "active" : ""}`}
              onClick={() => onPageChange?.(page)}
            >
              {page}
            </button>
          ))}

          <button
            type="button"
            className="sc-page-arrow"
            onClick={() => onPageChange?.(currentPage + 1)}
            disabled={currentPage >= totalPages}
            aria-label="Página siguiente"
          >
            <svg {...icon} width="14" height="14">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}