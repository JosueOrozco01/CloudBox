import { invalidateReadCache } from "../../services/readCache";
import { lazy, Suspense } from "react";
import { downloadFile } from "../../utils/filePreview";
import { prepareFilePreview } from '../../utils/previewLoaders';
import { clearSession } from "../../services/authService";
import { formatFileSize } from "../../utils/preferences";
import { getFileFavorites, setItemFavorite, favoriteKey } from "../../services/favoriteService";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import MisArchivos from "./FileBrowserView";
import RenameItemModal from "../RenameItemModal/RenameItemModal";
import FileActionModal from "../FileActionModal/FileActionModal";
import { reorderItems } from "./fileFilters";
import {
  request,
  getUserFiles,
  getUserFolders,
  getDashboard,
  toDashboardProps,
  createDashboardFolder,
  getFileDownloadUrl,
  getTrashFiles,
  getTrashFolders,
  renameItem,
  trashItem,
  permanentlyDeleteFile,
  restoreItem,
  moveItem,
  getFolderLocations,
} from "../../services/dashboardService";
import ConnectedUploadModal from "../../components/FileUpload/ConnectedUploadModal";
import CreateFolderModal from "../../components/CreateFolderModal/Createfoldermodal";
import Loading from "../../components/Loading/Loading";
import AlertModal from "../../components/AlertModal/AlertModal";
import Footer from "../../components/FooterSignOut/Footer";

const FilePreview = lazy(() => import("../../components/FilePreview/FilePreview"));

export default function FileBrowser({ user, trash = false }) {
  const navigate = useNavigate();
  const [preview, setPreview] = useState(null);
  const dragSnapshot = useRef(null);
  const dropCommitted = useRef(false);
  const [params, setParams] = useSearchParams();
  const folderId = params.get("folder");
  const favoritesMode = !trash && params.get("favorites") === "1";
  const [favoriteKeys, setFavoriteKeys] = useState([]);
  const [favoriteWarning, setFavoriteWarning] = useState("");
  const [favoriteAvailability, setFavoriteAvailability] = useState({ files: false, folders: false });
  const [favoritePending, setFavoritePending] = useState([]);
  const pendingFavorites = useRef(new Set());
  const search = params.get("search") || "";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [uploadStorage, setUploadStorage] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [folderError, setFolderError] = useState("");
  const [notice, setNotice] = useState(null);
  const [page, setPage] = useState(1);
  const [locations, setLocations] = useState([]);
  const [action, setAction] = useState(null);
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [actionError, setActionError] = useState("");
  const orderKey = `cloudbox:order:${user?.id}:${folderId || "root"}:${trash}:${favoritesMode}`;

  useEffect(() => {
    let active = true;
    const sessionToken = localStorage.getItem('token');
    let summaryData = null;
    getDashboard().then(summary => {
      if (!active) return;
      summaryData = toDashboardProps(summary);
      setData(previous => previous ? { ...previous, ...summaryData } : previous);
    }).catch(() => { /* The file list remains usable without account metrics. */ });
    if (!trash) getFolderLocations().then(rows => {
      if (active) setLocations(rows);
    }).catch(() => { /* Move and create actions can retry loading destinations. */ });
    Promise.all([
      trash ? getTrashFiles() : favoritesMode ? Promise.resolve([]) : getUserFiles(folderId),
      trash ? getTrashFolders() : favoritesMode ? Promise.resolve([]) : getUserFolders(folderId),
      trash ? Promise.resolve([]) : Promise.allSettled([getFileFavorites()]),
    ])
      .then(([files, folders, favoriteResults]) => {
        if (!active) return;
        const fileResult = favoriteResults[0];
        const fileFavorites = fileResult?.status === "fulfilled" ? fileResult.value : [];
        const favoriteError = favoriteResults.find(result => result.status === "rejected" && result.reason.status === 401);
        if (favoriteError) throw favoriteError.reason;
        setFavoriteKeys(fileFavorites.map(f => `file-${f.id_archivo}`));
        setFavoriteAvailability({ files: fileResult?.status === "fulfilled", folders: false });
        setFavoriteWarning(favoriteResults.filter(result => result.status === "rejected").map(result => result.reason.message).join(" "));
        if (favoritesMode) {
          files = fileFavorites.map(f => f.archivo).filter(Boolean);
          folders = [];
        }
        const date = (value) =>
          value ? new Date(value).toLocaleDateString("es-GT") : "—";
        let items = [
          ...folders.map((folder) => ({
            id: `folder-${folder.id}`,
            rawId: folder.id,
            isShared: Number(folder.id_usuario) !== Number(user?.id),
            name: folder.nombre,
            type: "carpeta",
            typeLabel: "Carpeta",
            bytes: 0,
            size: "—",
            modified: date(folder.fecha_modificacion || folder.fecha_creacion),
            timestamp: folder.fecha_modificacion || folder.fecha_creacion,
          })),
          ...files.map((file) => ({
            id: `file-${file.id}`,
            rawId: file.id,
            deletionPending: file.id_estado === 3,
            isShared: Number(file.id_usuario) !== Number(user?.id),
            name: file.nombre,
            type: file.nombre.split(".").pop().toLowerCase(),
            typeLabel: file.id_estado === 3 ? 'Borrado pendiente' : file.nombre.split(".").pop().toUpperCase(),
            bytes: Number(file.tamano_bytes),
            size: formatFileSize(file.tamano_bytes),
            modified: date(file.fecha_modificacion || file.fecha_subida),
            timestamp: file.fecha_modificacion || file.fecha_subida,
          })),
        ].sort(
          (a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0),
        );
        try {
          const order = JSON.parse(localStorage.getItem(orderKey) || "[]");
          if (Array.isArray(order))
            items.sort(
              (a, b) =>
                (order.indexOf(a.id) < 0 ? Infinity : order.indexOf(a.id)) -
                (order.indexOf(b.id) < 0 ? Infinity : order.indexOf(b.id)),
            );
        } catch {
          /* Un orden local inválido no impide cargar archivos. */
        }
        setData({ ...(summaryData || { storage: null, fileCount: files.length, folderCount: folders.length }), items });
        setError("");
      })
      .catch((error) => {
        if (!active) return;
        if (error.status === 401) {
          if (!clearSession(sessionToken)) return;
          navigate("/login", {
            replace: true,
            state: {
              alert: {
                type: "info",
                message:
                  "Tu sesión venció. Inicia sesión nuevamente para continuar.",
              },
            },
          });
          return;
        }
        setError(error.message);
        setNotice({
          type: "error",
          message:
            "No se pudo obtener la lista de archivos. Vuelve a intentarlo en unos momentos.",
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [folderId, trash, favoritesMode, revision, orderKey, navigate, user?.id]);

  const refresh = () => {
    invalidateReadCache();
    setRevision((value) => value + 1);
  };
  const changeFolder = (id) => {
    setLoading(true);
    setPage(1);
    setParams(id ? { folder: String(id) } : {});
  };
  const toggleFavorite = async item => {
    const key = favoriteKey(item);
    if (pendingFavorites.current.has(key)) return;
    pendingFavorites.current.add(key); setFavoritePending([...pendingFavorites.current]);
    const next = !favoriteKeys.includes(key);
    try {
      await setItemFavorite(item, next);
      setFavoriteKeys(keys => next ? [...new Set([...keys, key])] : keys.filter(value => value !== key));
      if (favoritesMode && !next) setData(previous => ({ ...previous, items: previous.items.filter(row => row.id !== item.id) }));
      setNotice({ type: "success", message: next ? `«${item.name}» agregado a Mis favoritos.` : `«${item.name}» eliminado de Mis favoritos.` });
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    } finally {
      pendingFavorites.current.delete(key); setFavoritePending([...pendingFavorites.current]);
    }
  };
  const openFile = async (item, download = false) => {
    if (item.type === "carpeta") {
      if (item.isShared) navigate(`/compartidos?folder=${item.rawId}`);
      else changeFolder(item.rawId);
      return;
    }
    const getUrl = () => item.isShared
      ? request(`/shares/files/${item.rawId}/download-url`)
      : getFileDownloadUrl(item.rawId);
    if (!download) { setPreview(prepareFilePreview(item, getUrl)); return; }
    try {
      await downloadFile(getUrl, item.name);
    } catch {
      setNotice({
        type: "error",
        message:
          "No se pudo descargar el archivo. Vuelve a intentarlo en unos momentos.",
      });
    }
  };
  const loadLocations = async () => {
    try {
      const result = await getFolderLocations();
      setLocations(result);
    } catch {
      setNotice({
        type: "error",
        message:
          "No se pudieron obtener las carpetas disponibles. Vuelve a intentarlo en unos momentos.",
      });
    }
  };
  const openAction = (kind, item) => {
    if (item.deletionPending && kind !== 'permanent') {
      setNotice({ type: 'warning', message: 'El borrado físico está pendiente. Reintenta la eliminación definitiva.' });
      return;
    }
    setAction({ kind, item });
    setName(item.name);
    setDestination(folderId || "");
    setActionError("");
    if (kind === "move") loadLocations();
  };
  const run = async (operation, message, tone = "success") => {
    if (busy) return;
    setBusy(true);
    setActionError("");
    try {
      await operation();
      setAction(null);
      if (message) setNotice({ type: "success", tone, message });
      refresh();
    } catch (error) {
      setActionError(error.message);
      if (error.code === 'STORAGE_DELETE_PENDING') refresh();
      setNotice({
        type: "error",
        message:
          error.message || "No se pudo guardar el cambio. Inténtalo nuevamente.",
      });
    } finally {
      setBusy(false);
    }
  };
  const reorder = (sourceId, targetId, persist = true) => {
    const items = reorderItems(data.items, sourceId, targetId);
    setData((previous) => ({ ...previous, items }));
    try {
      if (persist)
        localStorage.setItem(
          orderKey,
          JSON.stringify(items.map((item) => item.id)),
        );
    } catch {
      /* El orden sigue funcionando en esta sesión. */
    }
  };
  if (loading && !uploadOpen) return <Loading />;
  const folderLocations = locations.filter(
    (location) =>
      !action ||
      location.id !== action.item.rawId ||
      action.item.type !== "carpeta",
  );
  return (
    <>
      {error && (
        <div className="mf-feedback" role="alert">
          {error}{" "}
          <button type="button" onClick={refresh}>
            Reintentar
          </button>
        </div>
      )}
      {favoriteWarning && !trash && <div className="mf-feedback mf-favorite-warning" role="alert">{favoriteWarning}<button className="mf-folder-btn" type="button" onClick={refresh}>Reintentar favoritos</button></div>}
      {data && (
        <>
          <MisArchivos
            onBack={
              trash
                ? () => navigate("/archivos")
                : folderId || favoritesMode
                  ? () => changeFolder(null)
                  : null
            }
            favoritesMode={favoritesMode}
            onFavorites={() => { setPage(1); setLoading(true); setParams({ favorites: "1" }); }}
            showFavoritesFolder={!trash && !folderId && !favoritesMode}
            favoriteKeys={favoriteKeys}
            favoritePending={favoritePending}
            favoriteAvailability={favoriteAvailability}
            onToggleFavorite={toggleFavorite}
            items={data.items}
            storage={data.storage}
            query={search}
            trash={trash}
            busy={busy}
            totalCount={
              trash || favoritesMode ? data.items.length : data.fileCount + data.folderCount
            }
            folderCount={
              trash || favoritesMode
                ? data.items.filter((item) => item.type === "carpeta").length
                : data.folderCount
            }
            fileCount={
              trash || favoritesMode
                ? data.items.filter((item) => item.type !== "carpeta").length
                : data.fileCount
            }
            locations={locations}
            currentFolder={folderId}
            onFolderFilter={changeFolder}
            currentPage={page}
            onPageChange={setPage}
            onUpload={() => {
              setUploadStorage(data.storage);
              setUploadOpen(true);
            }}
            onCreateFolder={() => {
              setFolderError("");
              setFolderOpen(true);
              loadLocations();
            }}
            onSearch={(value) => {
              const next = new URLSearchParams(params);
              if (value) next.set("search", value);
              else next.delete("search");
              setParams(next, { replace: true });
            }}
            onTrash={() => navigate(trash ? "/archivos" : "/papelera")}
            onOpenItem={openFile}
            onDownloadItem={item => openFile(item, true)}
            onRename={(item) => openAction("rename", item)}
            onDelete={(item) => openAction(trash ? 'permanent' : 'delete', item)}
            onMove={(item) => openAction("move", item)}
            onRestore={(item) =>
              item.deletionPending ? setNotice({type:'warning',message:'El borrado físico está pendiente. Reintenta la eliminación definitiva.'}) : run(
                () => restoreItem(item),
                `«${item.name}» restaurado correctamente.`,
              )
            }
            onDragBegin={() => {
              dragSnapshot.current = data.items;
              dropCommitted.current = false;
            }}
            onPreviewOrder={(sourceId, targetId) =>
              reorder(sourceId, targetId, false)
            }
            onDragFinish={() => {
              const original = dragSnapshot.current;
              if (!dropCommitted.current && original)
                setData((previous) => ({ ...previous, items: original }));
              dragSnapshot.current = null;
            }}
            onDropItem={(sourceId, target) => {
              const source = data.items.find((item) => item.id === sourceId);
              if (!source || sourceId === target.id) return;
              dropCommitted.current = true;
              if (target.type === "carpeta") {
                const original = dragSnapshot.current || data.items;
                setData((previous) => ({
                  ...previous,
                  items: previous.items.filter((item) => item.id !== sourceId),
                }));
                run(async () => {
                  try {
                    await moveItem(source, target.rawId);
                  } catch (error) {
                    setData((previous) => ({ ...previous, items: original }));
                    throw error;
                  }
                }, `«${source.name}» movido a «${target.name}».`, "info");
              } else {
                try {
                  localStorage.setItem(
                    orderKey,
                    JSON.stringify(data.items.map((item) => item.id)),
                  );
                } catch {
                  /* El orden permanece en esta sesión. */
                }
              }
            }}
            onItemInfo={(item) =>
              setNotice({
                type: "info",
                message: `${item.name} · ${item.typeLabel} · ${item.size} · Modificado: ${item.modified}`,
              })
            }
          />
        </>
      )}
      <Footer />
      {preview && <Suspense fallback={<Loading fullScreen={false} text="Cargando vista previa" />}><FilePreview item={preview.item} getUrl={preview.getUrl} source={preview.source} onClose={() => setPreview(null)} /></Suspense>}
      {uploadOpen && (
        <ConnectedUploadModal
          storage={uploadStorage}
          folderId={folderId}
          onUploaded={refresh}
          onUploadResult={({ completed, failed }) =>
            setNotice({
              type: failed ? (completed ? "warning" : "error") : "success",
              message: failed
                ? `${completed === 1 ? "Se cargó 1 archivo" : `Se cargaron ${completed} archivos`}. ${failed === 1 ? "No se pudo cargar 1 archivo" : `No se pudieron cargar ${failed} archivos`}. Revisa el detalle de la carga para volver a intentarlo.`
                : completed === 1
                  ? "El archivo se cargó correctamente."
                  : `Los ${completed} archivos se cargaron correctamente.`,
            })
          }
          onClose={() => setUploadOpen(false)}
          onViewPlans={() => navigate('/plan')}
        />
      )}
      {folderOpen && (
        <CreateFolderModal
          isOpen
          defaultLocationId={folderId}
          locations={locations}
          isCreating={busy}
          errorMessage={folderError}
          onClose={() => {
            if (!busy) setFolderOpen(false);
          }}
          onCreate={async ({ name, locationId }) => {
            if (busy) return;
            setBusy(true);
            try {
              await createDashboardFolder(name, locationId);
              setFolderOpen(false);
              setNotice({
                type: "success",
                message: `Carpeta «${name}» creada correctamente.`,
              });
              refresh();
            } catch (error) {
              setFolderError(error.message);
              setNotice({
                type: "error",
                message:
                  "No se pudo crear la carpeta. Revisa los datos e inténtalo nuevamente.",
              });
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
      {action?.kind === "rename" && (
        <RenameItemModal
          item={action.item}
          name={name}
          onNameChange={setName}
          busy={busy}
          error={actionError}
          onClose={() => setAction(null)}
          onSubmit={() =>
            run(
              () => renameItem(action.item, name.trim()),
              "Nombre actualizado correctamente.",
              "info",
            )
          }
        />
      )}
      {action && action.kind !== "rename" && (
        <FileActionModal
          action={action}
          busy={busy}
          error={actionError}
          destination={destination}
          onDestinationChange={setDestination}
          locations={folderLocations}
          onClose={() => setAction(null)}
          onSubmit={() =>
            run(
              () =>
                action.kind === "permanent"
                  ? permanentlyDeleteFile(action.item.rawId)
                  : action.kind === "delete"
                  ? trashItem(action.item)
                  : moveItem(
                      action.item,
                      destination ? Number(destination) : null,
                    ),
              action.kind === "permanent"
                ? `«${action.item.name}» eliminado permanentemente.`
                : action.kind === "delete"
                ? `«${action.item.name}» enviado a la papelera.`
                : `«${action.item.name}» movido correctamente.`,
              action.kind === "delete" ? "error" : "info",
            )
          }
          onReorder={(direction) => {
            const index = data.items.findIndex(
              (item) => item.id === action.item.id,
            );
            const target = data.items[index + direction];
            if (target) reorder(action.item.id, target.id);
          }}
        />
      )}
      <AlertModal
        variant="toast"
        tone={notice?.tone || notice?.type || "info"}
        autoClose
        autoCloseTime={notice?.type === "error" ? 7000 : 4500}
        isOpen={Boolean(notice)}
        type={notice?.type || "info"}
        message={notice?.message || ""}
        title={
          notice?.type === "success"
            ? "Operación completada"
            : notice?.type === "error"
              ? "No se pudo completar la operación"
              : notice?.type === "warning"
                ? "Revisa la carga de archivos"
                : "Información"
        }
        onClose={() => setNotice(null)}
      />
    </>
  );
}
