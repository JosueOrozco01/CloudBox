import { useState } from "react";
import {
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

export default function MisArchivos({
  items = [],
  totalCount = 0,
  folderCount = 0,
  fileCount = 0,
  currentPage = 1,
  query = "",
  trash = false,
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
  return (
    <main className="mf-page">
      <header className="mf-header">
        <div>
          <h1>{trash ? "Papelera" : "Mis Archivos"}</h1>
          <p>Organiza, busca y administra todos tus archivos</p>
        </div>
        {onBack && (
          <button className="mf-folder-btn mf-back-btn" type="button" onClick={onBack}>
            <ArrowLeft size={18} />
            Mis Archivos
          </button>
        )}
      </header>
      <div className="mf-search-actions">
        <form
          className="mf-search"
          onSubmit={(event) => event.preventDefault()}
        >
          <input
            type="search"
            placeholder="Buscar en mis archivos…"
            value={query}
            onChange={(event) => {
              onSearch(event.target.value);
              onPageChange(1);
            }}
            aria-label="Buscar archivos"
          />
        </form>
        <div className="mf-tabs">
          {[
            ["todos", "Todos"],
            ["archivos", "Archivos"],
            ["carpetas", "Carpetas"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              type="button"
              onClick={() => {
                setTab(id);
                onPageChange(1);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {!trash && (
          <>
            <button
              className="mf-folder-btn"
              type="button"
              onClick={onCreateFolder}
            >
              <FolderPlus size={16} />
              Crear carpeta
            </button>
            <button className="mf-upload-btn" type="button" onClick={onUpload}>
              <Upload size={16} />
              Subir archivo
            </button>
          </>
        )}
        {!trash && (
          <button className="mf-folder-btn" type="button" onClick={onTrash}>
            <Trash2 size={18} />
            Papelera
          </button>
        )}
      </div>
      <section className="mf-stats">
        {[
          [
            "Mis archivos",
            `${totalCount} elementos`,
            `${folderCount} carpetas y ${fileCount} archivos`,
          ],
          ["Carpetas", `${folderCount} carpetas`, "Organiza tus proyectos"],
          ["Archivos", `${fileCount} archivos`, "Archivos de tu perfil"],
        ].map(([label, value, sub]) => (
          <article key={label} className="mf-stat-card">
            <p className="mf-stat-label">{label}</p>
            <p className="mf-stat-value">{value}</p>
            <p className="mf-stat-sub">{sub}</p>
          </article>
        ))}
      </section>
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
          <label>
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
          </label>
          <label>
            Fecha{" "}
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
          <label>
            Ordenar{" "}
            <select value={sort} onChange={reset(setSort)}>
              <option value="manual">Manual</option>
              <option value="recent">Más reciente</option>
              <option value="name">Nombre</option>
              <option value="size">Tamaño</option>
            </select>
          </label>
          <button
            type="button"
            className="mf-folder-btn"
            onClick={() =>
              setView((value) => (value === "list" ? "grid" : "list"))
            }
          >
            {view === "list" ? "Cuadrícula" : "Lista"}
          </button>
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
              <tr>
                <td colSpan={5}>No hay elementos para mostrar.</td>
              </tr>
            )}
            {visible.map((item) => (
              <tr
                key={item.id}
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
                  if (!dragged || trash || dragged === item.id) return;
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
                  <div className="mf-name-cell">
                    <FileTypeIcon type={item.type} />
                    <span>{item.name}</span>
                  </div>
                </td>
                <td className="mf-muted">{item.typeLabel}</td>
                <td className="mf-muted">{item.size}</td>
                <td className="mf-muted">{item.modified}</td>
                <td>
                  <div className="mf-actions">
                    {trash ? (
                      <button
                        type="button"
                        className="mf-restore-btn"
                        onClick={() => onRestore(item)}
                      >
                        <RotateCcw size={15} />
                        Restaurar
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="mf-open-btn"
                          onClick={() => onOpenItem(item)}
                        >
                          Abrir
                        </button>
                        <button
                          type="button"
                          className="mf-icon-btn"
                          title="Cambiar nombre"
                          aria-label={`Cambiar nombre de ${item.name}`}
                          onClick={() => onRename(item)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          className="mf-icon-btn"
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
                          title="Mover o cambiar orden"
                          aria-label={`Mover ${item.name}`}
                          draggable
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
