import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import MisArchivos from "./FileBrowserView";
import RenameItemModal from "../RenameItemModal/RenameItemModal";
import FileActionModal from "../FileActionModal/FileActionModal";
import { reorderItems } from "./fileFilters";
import {
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
  restoreItem,
  moveItem,
  getFolderLocations,
} from "../../services/dashboardService";
import ConnectedUploadModal from "../../components/FileUpload/ConnectedUploadModal";
import CreateFolderModal from "../../components/CreateFolderModal/Createfoldermodal";
import Loading from "../../components/Loading/Loading";
import AlertModal from "../../components/AlertModal/AlertModal";
import Footer from "../../components/FooterSignOut/Footer";

export default function FileBrowser({ user, trash = false }) {
  const navigate = useNavigate();
  const dragSnapshot = useRef(null);
  const dropCommitted = useRef(false);
  const [params, setParams] = useSearchParams();
  const folderId = params.get("folder");
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
  const orderKey = `cloudbox:order:${user?.id}:${folderId || "root"}:${trash}`;

  useEffect(() => {
    let active = true;
    Promise.all([
      trash ? getTrashFiles() : getUserFiles(folderId),
      trash ? getTrashFolders() : getUserFolders(folderId),
      getDashboard(),
      trash ? Promise.resolve([]) : getFolderLocations(),
    ])
      .then(([files, folders, summary, folderLocations]) => {
        if (!active) return;
        const date = (value) =>
          value ? new Date(value).toLocaleDateString("es-GT") : "—";
        let items = [
          ...folders.map((folder) => ({
            id: `folder-${folder.id}`,
            rawId: folder.id,
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
            name: file.nombre,
            type: file.nombre.split(".").pop().toLowerCase(),
            typeLabel: file.nombre.split(".").pop().toUpperCase(),
            bytes: Number(file.tamano_bytes),
            size: `${(Number(file.tamano_bytes) / 1024 ** 2).toFixed(2)} MB`,
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
        setData({ ...toDashboardProps(summary), items });
        setLocations(folderLocations);
        setError("");
      })
      .catch((error) => {
        if (!active) return;
        if (error.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("refreshToken");
          localStorage.removeItem("user");
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
  }, [folderId, trash, revision, orderKey, navigate]);

  const refresh = () => {
    setRevision((value) => value + 1);
  };
  const changeFolder = (id) => {
    setLoading(true);
    setPage(1);
    setParams(id ? { folder: String(id) } : {});
  };
  const openFile = async (item) => {
    if (item.type === "carpeta") {
      changeFolder(item.rawId);
      return;
    }
    try {
      const result = await getFileDownloadUrl(item.rawId);
      window.location.assign(result.url);
    } catch {
      setNotice({
        type: "error",
        message:
          "No se pudo abrir el archivo. Vuelve a intentarlo en unos momentos.",
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
      setNotice({
        type: "error",
        message:
          "No se pudo guardar el cambio. Revisa los datos e inténtalo nuevamente.",
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
      {data && (
        <>
          <MisArchivos
            onBack={
              trash
                ? () => navigate("/archivos")
                : folderId
                  ? () => changeFolder(null)
                  : null
            }
            items={data.items}
            query={search}
            trash={trash}
            totalCount={
              trash ? data.items.length : data.fileCount + data.folderCount
            }
            folderCount={
              trash
                ? data.items.filter((item) => item.type === "carpeta").length
                : data.folderCount
            }
            fileCount={
              trash
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
            onDownloadItem={openFile}
            onRename={(item) => openAction("rename", item)}
            onDelete={(item) => openAction("delete", item)}
            onMove={(item) => openAction("move", item)}
            onRestore={(item) =>
              run(
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
          onViewPlans={() =>
            setNotice({
              type: "info",
              message:
                "La administración de planes estará disponible próximamente.",
            })
          }
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
                action.kind === "delete"
                  ? trashItem(action.item)
                  : moveItem(
                      action.item,
                      destination ? Number(destination) : null,
                    ),
              action.kind === "delete"
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
