import ViewToggle from "../ViewToggle/ViewToggle";
import { useState } from "react";
import { preloadFilePreview } from '../../utils/previewLoaders';
import {
  ArrowRight,
  ChevronRight,
  Cloud,
  FileText,
  FolderOpen,
  Search,
  X,
  Star,
  FolderHeart,
  Upload,
  FolderPlus,
  Trash2,
  GripVertical,
  Pencil,
  Download,
  Info,
  RotateCcw,
  ArrowLeft,
} from "lucide-react";
import FileTypeIcon from "../FileTypeIcon/FileTypeIcon";
import { matchesFileFilters } from "./fileFilters";
import "./FileBrowser.css";
import FileLibraryHero from "./FileLibraryHero";
import TrashOverview, { TrashGuidance } from "./TrashOverview";
import "./FileLibrary.css";

export default function MisArchivos({
  favoritesMode = false,
  showFavoritesFolder = false,
  onFavorites,
  favoriteKeys = [],
  favoritePending = [],
  favoriteAvailability = {},
  onToggleFavorite,
  items = [],
  storage = null,
  totalCount = 0,
  folderCount = 0,
  fileCount = 0,
  currentPage = 1,
  query = "",
  trash = false,
  busy = false,
  onBack,
  onSearch,
  onUpload,
  onCreateFolder,
  onOpenItem,
  onDownloadItem,
  onItemInfo,
  onPageChange,
  onTrash,
  onRename,
  onDelete,
  onRestore,
  onMove,
  onDropItem,
  onPreviewOrder,
  onDragBegin,
  onDragFinish,
  locations = [],
  currentFolder = "",
  onFolderFilter,
}) {
  const [tab, setTab] = useState("todos");
  const [view, setView] = useState("list");
  const [type, setType] = useState("");
  const [date, setDate] = useState("");
  const [size, setSize] = useState("");
  const [sort, setSort] = useState("manual");
  const [dragged, setDragged] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const reset = (setter) => (event) => {
    setter(event.target.value);
    onPageChange?.(1);
  };
  const [filterTime] = useState(() => Date.now());
  let filtered = items.filter((item) =>
    matchesFileFilters(item, { query, tab, type, date, size }, filterTime),
  );
  if (sort !== "manual")
    filtered = [...filtered].sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "size"
          ? b.bytes - a.bytes
          : new Date(b.timestamp || 0) - new Date(a.timestamp || 0),
    );
  const totalPages = Math.max(1, Math.ceil(filtered.length / 10));
  const page = Math.min(currentPage, totalPages);
  const visible = filtered.slice((page - 1) * 10, page * 10);
  const scoped = Boolean(currentFolder || favoritesMode || trash);
  const displayedTotal = scoped ? items.length : totalCount;
  const displayedFolders = scoped ? items.filter(item => item.type === 'carpeta').length : folderCount;
  const displayedFiles = scoped ? items.filter(item => item.type !== 'carpeta').length : fileCount;
  const hasFilters = Boolean(query || type || date || size || tab !== 'todos');
  const clearFilters = () => { setTab('todos'); setType(''); setDate(''); setSize(''); onSearch?.(''); onPageChange?.(1); };
  return (
    <main className={`mf-page ${trash ? "mf-trash-page" : ""}`}>
      <header className="mf-header">
        <div>
          <h1>{trash ? "Papelera" : favoritesMode ? "Mis favoritos" : "Mis Archivos"}</h1>
          <p>{trash ? "Recupera lo que necesitas y elige qué dejar atrás." : favoritesMode ? "Tus archivos destacados, siempre a mano" : "Organiza, busca y administra todos tus archivos"}</p>
        </div>
        <div className="mf-header-right">{onBack && <button className="mf-folder-btn mf-back-btn" type="button" onClick={onBack}><ArrowLeft size={16} />Mis Archivos</button>}{!trash && !favoritesMode && <><button className="mf-folder-btn" type="button" onClick={onCreateFolder}><FolderPlus size={16} />Crear carpeta</button><button className="mf-upload-btn" type="button" onClick={onUpload}><Upload size={16} />Subir archivo</button></>}{!trash && <button className="mf-folder-btn mf-trash-shortcut" type="button" onClick={onTrash} title="Abrir papelera"><Trash2 size={16} />Papelera</button>}</div>
      </header>
      {trash && <TrashOverview />}
      {!trash && !favoritesMode && !currentFolder && <FileLibraryHero storage={storage} onUpload={onUpload} />}
      {favoritesMode && <div className="mf-library-favorites-banner"><span><FolderHeart size={30} /></span><div><h2>Lo importante, siempre cerca.</h2><p>Tus favoritos son accesos a los archivos originales, sin moverlos ni crear copias.</p></div><Star size={25} /></div>}
      {currentFolder && !trash && <nav className="mf-library-breadcrumb" aria-label="Carpeta actual"><button type="button" onClick={onBack}><FolderOpen size={15} />Mis Archivos</button><ChevronRight size={14} /><span>{locations.find(location => String(location.id) === String(currentFolder))?.name || 'Carpeta actual'}</span></nav>}
      <section className={`mf-library-stats ${showFavoritesFolder ? 'with-favorites' : ''}`} aria-label="Resumen de archivos">{[[trash ? Trash2 : Cloud, trash ? 'Elementos en papelera' : scoped ? 'Elementos en esta vista' : 'En tu biblioteca', displayedTotal, trash ? 'Archivos y carpetas de esta vista' : scoped ? 'Contenido de esta ubicación' : 'Archivos y carpetas de tu cuenta', 'todos', 'blue'], [FolderOpen, 'Carpetas', displayedFolders, trash ? 'Carpetas que puedes restaurar' : 'Un lugar para cada proyecto', 'carpetas', 'violet'], [FileText, 'Archivos', displayedFiles, trash ? 'Restaura o elimina permanentemente' : 'Tus ideas, en todos sus formatos', 'archivos', 'cyan']].map(([Icon, label, value, hint, target, tone]) => <button type="button" className="mf-library-stat" key={target} onClick={() => { setTab(target); setType(''); setDate(''); setSize(''); onSearch?.(''); onPageChange?.(1); }}><span className={`mf-library-stat-icon ${tone}`}><Icon size={21} strokeWidth={1.8} /></span><span><span className="mf-library-stat-label">{label}</span><strong>{value}</strong><small>{hint}</small></span></button>)}{showFavoritesFolder && <button className="mf-library-stat mf-library-favorites" type="button" onClick={onFavorites}><span className="mf-library-stat-icon gold"><FolderHeart size={23} /></span><span><span className="mf-library-stat-label">Mis favoritos</span><strong>{favoriteAvailability.files ? favoriteKeys.length : '—'}</strong><small>Tus archivos con una estrella</small></span><ArrowRight size={15} /></button>}</section>
      {trash && <TrashGuidance />}
      <div className="mf-library-heading"><div><span className="mf-library-kicker">{trash ? 'DALES UNA SEGUNDA OPORTUNIDAD' : favoritesMode ? 'TUS ACCESOS DESTACADOS' : 'TU BIBLIOTECA, A TU MANERA'}</span><h2>{trash ? 'Elementos en papelera' : favoritesMode ? 'Tus archivos favoritos' : currentFolder ? 'Dentro de esta carpeta' : 'Todo lo que guardas'}</h2><p>{trash ? 'Restaura lo que necesitas o elimina archivos permanentemente.' : favoritesMode ? 'Encuentra y abre lo que más utilizas.' : 'Encuentra, organiza y sigue con lo que estabas creando.'}</p></div><span className="mf-library-count" role="status">{filtered.length} {filtered.length === 1 ? 'elemento' : 'elementos'}</span></div>
      <div className="mf-search-actions"><div className="mf-tabs" role="group" aria-label="Filtrar archivos y carpetas">{[['todos', 'Todos', Cloud], ['archivos', 'Archivos', FileText], ['carpetas', 'Carpetas', FolderOpen]].map(([id, label, Icon]) => <button key={id} className={tab === id ? 'active' : ''} type="button" aria-pressed={tab === id} onClick={() => { setTab(id); onPageChange(1); }}><Icon size={15} />{label}</button>)}</div><form className="mf-search" onSubmit={event => event.preventDefault()}><Search size={17} className="mf-library-search-icon" /><input type="search" placeholder={trash ? 'Buscar en papelera…' : favoritesMode ? 'Buscar en mis favoritos…' : 'Buscar archivos o carpetas…'} value={query} onChange={event => { onSearch(event.target.value); onPageChange(1); }} aria-label="Buscar archivos" />{query && <button type="button" className="mf-library-search-clear" aria-label="Limpiar búsqueda de archivos" onClick={() => { onSearch(''); onPageChange(1); }}><X size={15} /></button>}</form></div>
      <div className="mf-toolbar">
        <div className="mf-filters">
          <label>
            Tipo{" "}
            <select value={type} onChange={reset(setType)}>
              <option value="">Todos</option>
              {[...new Set(items.map((item) => item.type))].map((type) => (
                <option key={type} value={type}>
                  {type.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          {!trash && <label>
            Carpeta{" "}
            <select
              disabled={trash}
              value={currentFolder || ""}
              onChange={(event) => onFolderFilter(event.target.value || null)}
            >
              <option value="">Mis Archivos (raíz)</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>}
          <label>
            {trash ? "Modificación" : "Fecha"}{" "}
            <select value={date} onChange={reset(setDate)}>
              <option value="">Todas</option>
              <option value="1">Últimas 24 horas</option>
              <option value="7">Últimos 7 días</option>
              <option value="30">Últimos 30 días</option>
            </select>
          </label>
          <label>
            Tamaño{" "}
            <select value={size} onChange={reset(setSize)}>
              <option value="">Todos</option>
              <option value="small">Menos de 1 MB</option>
              <option value="medium">1–10 MB</option>
              <option value="large">Más de 10 MB</option>
            </select>
          </label>
        </div>
        <div className="mf-toolbar-right">
          {hasFilters && <button className="mf-library-reset" type="button" onClick={clearFilters}>Limpiar<X size={13} /></button>}
          <label>
            Ordenar{" "}
            <select value={sort} onChange={reset(setSort)}>
              <option value="manual">Manual</option>
              <option value="recent">Más reciente</option>
              <option value="name">Nombre</option>
              <option value="size">Tamaño</option>
            </select>
          </label>
          <ViewToggle value={view} onChange={setView} />
        </div>
      </div>
      {dragged && (
        <p className="mf-drag-status" role="status">
          Moviendo {items.find((item) => item.id === dragged)?.name}.{" "}
          {dropTarget?.type === "carpeta"
            ? `Suelta para mover a ${dropTarget.name}.`
            : "Arrastra para cambiar el orden o suelta sobre una carpeta."}
        </p>
      )}
      <div className={`mf-table-wrap ${view === "grid" ? "mf-grid-view" : ""}`}>
        <table className="mf-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Tamaño</th>
              <th>Modificado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr className="mf-empty-row"><td colSpan={5}><div className="mf-library-empty"><span>{trash ? <Trash2 size={32} /> : favoritesMode ? <FolderHeart size={32} /> : <FolderOpen size={32} />}</span><h3>{hasFilters ? 'Probemos con otra búsqueda' : trash ? 'Tu papelera está despejada' : favoritesMode ? 'Guarda aquí tus imprescindibles' : 'Un espacio para tus próximas ideas'}</h3><p>No hay elementos para mostrar.{hasFilters ? ' Ajusta los filtros o busca con otro nombre.' : trash ? ' Los elementos que envíes a papelera aparecerán aquí.' : favoritesMode ? ' Marca un archivo con la estrella para encontrarlo aquí.' : ' Sube un archivo o crea una carpeta para empezar.'}</p>{hasFilters ? <button className="mf-folder-btn" type="button" onClick={clearFilters}>Ver todos los elementos</button> : !trash && !favoritesMode && <button className="mf-upload-btn" type="button" onClick={onUpload}><Upload size={15} />Subir mi primer archivo</button>}</div></td></tr>
            )}
            {visible.map((item) => (
              <tr
                key={item.id}
                onPointerEnter={() => { if (!trash && item.type !== 'carpeta') preloadFilePreview(item.name); }}
                onFocus={() => { if (!trash && item.type !== 'carpeta') preloadFilePreview(item.name); }}
                className={
                  dragged === item.id
                    ? "mf-row-dragging"
                    : dropTarget?.id === item.id
                      ? item.type === "carpeta"
                        ? "mf-drop-folder"
                        : "mf-drop-position"
                      : ""
                }
                onDragOver={(event) => {
                  if (!dragged || trash || item.isShared || dragged === item.id) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  if (dropTarget?.id !== item.id) {
                    setDropTarget(item);
                    setSort("manual");
                    if (item.type !== "carpeta")
                      onPreviewOrder(dragged, item.id);
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragged && dragged !== item.id) {
                    setSort("manual");
                    onDropItem(dragged, item);
                  }
                  setDragged(null);
                  setDropTarget(null);
                }}
              >
                <td>
                  <div className="mf-name-cell" data-type={item.type}>
                    <FileTypeIcon type={item.type} />
                    <div className="mf-library-resource">{trash ? <strong>{item.name}</strong> : <button type="button" onClick={() => onOpenItem(item)}>{item.name}</button>}<span>{item.type === 'carpeta' ? 'Carpeta' : item.isShared ? `${item.typeLabel} · Compartido contigo` : `${item.typeLabel} · Archivo`}</span></div>
                  </div>
                </td>
                <td className="mf-muted">{item.typeLabel}</td>
                <td className="mf-muted">{item.size}</td>
                <td className="mf-muted">{item.modified}</td>
                <td>
                  <div className="mf-actions">
                    {trash ? (
                      <>
                      <button
                        type="button"
                        className="mf-restore-btn"
                        disabled={busy}
                        onClick={() => onRestore(item)}
                      >
                        <RotateCcw size={16} />
                        Restaurar
                      </button>
                      {item.type !== 'carpeta' && <button type="button" className="mf-trash-delete-btn" title="Eliminar permanentemente: no se puede deshacer" aria-label={`Eliminar permanentemente ${item.name}`} disabled={busy} onClick={() => onDelete(item)}><Trash2 size={15} /><span>Eliminar archivo</span></button>}
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="mf-open-btn"
                          onClick={() => onOpenItem(item)}
                        >
                          Abrir
                        </button>
                        {item.type !== "carpeta" ? <button type="button" className={`mf-icon-btn ${favoriteKeys.includes(item.id) ? "favorite" : ""}`} aria-pressed={favoriteKeys.includes(item.id)} aria-label={`${favoriteKeys.includes(item.id) ? "Quitar de" : "Agregar a"} favoritos: ${item.name}`} title={favoriteKeys.includes(item.id) ? "Quitar de favoritos" : "Agregar a favoritos"} disabled={favoritePending.includes(item.id) || !(item.type === "carpeta" ? favoriteAvailability.folders : favoriteAvailability.files)} onClick={() => onToggleFavorite(item)}><Star size={16} fill={favoriteKeys.includes(item.id) ? "currentColor" : "none"} /></button> : <span className="mf-action-placeholder" aria-hidden="true" />}
                        <button
                          type="button"
                          className="mf-icon-btn"
                          disabled={item.isShared}
                          title="Cambiar nombre"
                          aria-label={`Cambiar nombre de ${item.name}`}
                          onClick={() => onRename(item)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          className="mf-icon-btn"
                          disabled={item.isShared}
                          title="Enviar a papelera"
                          aria-label={`Eliminar ${item.name}`}
                          onClick={() => onDelete(item)}
                        >
                          <Trash2 size={16} />
                        </button>
                        <button
                          type="button"
                          className="mf-icon-btn"
                          title="Descargar"
                          aria-label={`Descargar ${item.name}`}
                          disabled={item.type === "carpeta"}
                          onClick={() => onDownloadItem(item)}
                        >
                          <Download size={16} />
                        </button>
                        <button
                          type="button"
                          className="mf-icon-btn"
                          disabled={item.isShared}
                          title="Mover o cambiar orden"
                          aria-label={`Mover ${item.name}`}
                          draggable={!item.isShared}
                          onDragStart={(event) => {
                            event.dataTransfer.setData("text/plain", item.id);
                            event.dataTransfer.effectAllowed = "move";
                            const row = event.currentTarget.closest("tr");
                            if (row)
                              event.dataTransfer.setDragImage(row, 30, 20);
                            onDragBegin();
                            setDragged(item.id);
                          }}
                          onDragEnd={() => {
                            setDragged(null);
                            setDropTarget(null);
                            onDragFinish();
                          }}
                          onClick={() => onMove(item)}
                        >
                          <GripVertical size={16} />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="mf-icon-btn"
                      title="Información"
                      aria-label={`Información de ${item.name}`}
                      onClick={() => onItemInfo(item)}
                    >
                      <Info size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mf-pagination">
        <p>
          Mostrando {filtered.length ? (page - 1) * 10 + 1 : 0} a{" "}
          {Math.min(page * 10, filtered.length)} de {filtered.length} elementos
        </p>
        <div className="mf-pagination-controls">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Anterior
          </button>
          <span>
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Siguiente
          </button>
        </div>
      </div>
    </main>
  );
}
