import StorageBar from '../../components/StorageBar/StorageBar';
import { formatStorageBytes, formatStoragePercent, storagePercentage } from '../../utils/storageUsage';
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getDashboard,
  createDashboardFolder,
  toDashboardProps,
} from "../../services/dashboardService";
import ConnectedUploadModal from "../../components/FileUpload/ConnectedUploadModal";
import AlertModal from "../../components/AlertModal/AlertModal";
import Footer from "../../components/FooterSignOut/Footer";
import Loading from "../../components/Loading/Loading";
import FileTypeIcon from "../../components/FileTypeIcon/FileTypeIcon";
import CreateFolderModal from "../../components/CreateFolderModal/Createfoldermodal";
import "./Dashboard.css";

const icon = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

const defaultQuickActions = [
  {
    id: "upload",
    label: "Subir archivo",
    description: "Sube tus archivos a la nube",
    icon: <path d="M12 3v12 M7 8l5-5 5 5 M5 21h14" />,
  },
  {
    id: "folder",
    label: "Crear carpeta",
    description: "Organiza tus documentos",
    icon: (
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    ),
  },
  {
    id: "shared",
    label: "Compartido conmigo",
    description: "Revisa los recursos compartidos",
    icon: (
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75" />
    ),
  },
  {
    id: "plan",
    label: "Administrar plan",
    description: "Consulte los planes",
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </>
    ),
  },
];

function DashboardHome({
  user,
  storage,
  fileCount,
  folderCount,
  plan,
  recentFiles = [],
  quickActions = defaultQuickActions,
  onSearch,
  onUpload,
  onQuickAction,
  onViewAllFiles,
  onViewPlans,
  busy,
}) {
  const [query, setQuery] = useState("");
  const [showAlert, setShowAlert] = useState(true);

  const usedPercent = storagePercentage(storage?.usedGB * 1024 ** 3, storage?.totalGB * 1024 ** 3, storage?.percentageUsed);
  const isLowStorage = usedPercent >= 90;

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    onSearch?.(query);
  };

  return (
    <div className="dash-home">
      {/* Hero */}
      <section className="dash-hero">
        <div className="dash-hero-content">
          <h1>Hola, {user?.nombre ?? "de nuevo"}</h1>
          <p>
            Aquí tienes un resumen de tu almacenamiento y archivos recientes.
          </p>

          <form className="dash-search" onSubmit={handleSearchSubmit}>
            <label className="dash-search-field">
            <span className="dash-search-icon">
              <svg {...icon} width="16" height="16">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </span>
            <input
              type="search"
              aria-label="Buscar archivos"
              placeholder="Buscar archivos..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            </label>
            <button
              type="button"
              className="dash-upload-btn"
              onClick={onUpload}
              disabled={busy}
            >
              <svg {...icon} width="16" height="16">
                <path d="M12 3v12 M7 8l5-5 5 5 M5 21h14" />
              </svg>
              Subir archivo
            </button>
          </form>
        </div>

        <div className="dash-hero-art" aria-hidden="true">
          <svg viewBox="0 0 220 180" fill="none">
            <circle cx="150" cy="90" r="70" fill="#ffffff" opacity="0.06" />
            <path
              d="M70 110c-16 0-29-12-29-28 0-14 11-26 25-28 4-16 19-27 36-27 19 0 35 13 38 31 13 2 23 13 23 26 0 15-12 27-27 27H70z"
              fill="#ffffff"
              opacity="0.14"
            />
            <rect
              x="60"
              y="70"
              width="46"
              height="60"
              rx="6"
              fill="#ffffff"
              opacity="0.9"
              transform="rotate(-8 60 70)"
            />
            <rect
              x="105"
              y="60"
              width="46"
              height="60"
              rx="6"
              fill="#bfdcff"
              opacity="0.95"
              transform="rotate(6 105 60)"
            />
            <circle cx="190" cy="140" r="18" fill="#2563ff" />
            <path
              d="M190 148v-16 M183 139l7-7 7 7"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </section>

      {/* Tarjetas de estadísticas */}
      <section className="dash-stats">
        <article className="stat-card">
          <div className="stat-card-head">
            <span className="stat-icon">
              <svg {...icon}>
                <path d="M22 12H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
              </svg>
            </span>
            <button
              type="button"
              className="stat-more"
              aria-label="Ver almacenamiento de mi plan"
              onClick={onViewPlans}
            >
              ⋯
            </button>
          </div>
          <p className="stat-label">Almacenamiento</p>
          <p className="stat-value">
            {storage ? formatStorageBytes(storage.usedGB * 1024 ** 3) : "—"}{" "}
            <span>de {formatStorageBytes(storage?.totalGB * 1024 ** 3)}</span>
          </p>
          <p className="stat-sub">{formatStorageBytes(storage?.availableGB * 1024 ** 3)} disponibles</p>
          <StorageBar className="stat-progress" fillClassName="stat-progress-fill" usedBytes={storage?.usedGB * 1024 ** 3} totalBytes={storage?.totalGB * 1024 ** 3} />
          <p className="stat-percent">{formatStoragePercent(usedPercent)} usado</p>
        </article>

        <article className="stat-card">
          <div className="stat-card-head">
            <span className="stat-icon">
              <svg {...icon}>
                <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              </svg>
            </span>
            <button
              type="button"
              className="stat-more"
              aria-label="Ver mis archivos"
              onClick={onViewAllFiles}
            >
              ⋯
            </button>
          </div>
          <p className="stat-label">Mis archivos</p>
          <p className="stat-value">{fileCount}</p>
          <p className="stat-sub">Archivos · {folderCount} {folderCount === 1 ? 'carpeta' : 'carpetas'}</p>
        </article>

        <article className="stat-card">
          <div className="stat-card-head">
            <span className="stat-icon">
              <svg {...icon}>
                <circle cx="12" cy="8" r="6" />
                <path d="M15.5 13.5 17 22l-5-3-5 3 1.5-8.5" />
              </svg>
            </span>
            <button
              type="button"
              className="stat-more"
              aria-label="Ver mi plan"
              onClick={onViewPlans}
            >
              ⋯
            </button>
          </div>
          <p className="stat-label">Plan actual</p>
          <p className="stat-value">
            {plan
              ? `${plan.name} - ${storage.totalGB} GB`
              : "Sin suscripción activa"}
          </p>
          <p className="stat-sub">
            {plan?.renewDate
              ? `Vence el ${plan.renewDate}`
              : "Sin fecha de vencimiento"}
          </p>
        </article>
      </section>

      {/* Alerta de almacenamiento */}
      {isLowStorage && showAlert && (
        <div className="dash-alert">
          <svg {...icon} width="18" height="18">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4 M12 16h.01" />
          </svg>
          <p>
            Te queda poco espacio de almacenamiento. Has utilizado el{" "}
            {usedPercent}% de tu espacio gratis. Consigue más espacio para
            seguir guardando.
          </p>
          <button
            type="button"
            className="dash-alert-btn"
            onClick={onViewPlans}
          >
            Ver planes
          </button>
          <button
            type="button"
            className="dash-alert-close"
            aria-label="Cerrar aviso"
            onClick={() => setShowAlert(false)}
          >
            <svg {...icon} width="16" height="16">
              <path d="m18 6-12 12 M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Archivos recientes + accesos rápidos */}
      <section className="dash-columns">
        <div className="dash-card dash-recent">
          <div className="dash-card-head">
            <div>
              <h2>Archivos recientes</h2>
              <p>Tus cinco archivos más recientes</p>
            </div>
            <button
              type="button"
              className="dash-link-btn"
              onClick={onViewAllFiles}
            >
              Ver todo
            </button>
          </div>

          <ul className="dash-file-list">
            {recentFiles.length === 0 && <li>Todavía no tienes archivos.</li>}
            {recentFiles.map((file) => (
              <li key={file.id}>
                <FileTypeIcon type={file.type} className="file-icon" />
                <div className="file-info">
                  <p className="file-name">{file.name}</p>
                  <p className="file-meta">{file.meta}</p>
                </div>
                <span className="file-date">{file.date}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="dash-side">
          <div className="dash-card">
            <div className="dash-card-head">
              <div>
                <h2>Accesos rápidos</h2>
                <p>Gestiona tu espacio de forma rápida</p>
              </div>
            </div>

            <div className="quick-actions-grid">
              {quickActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className="quick-action"
                  disabled={busy}
                  onClick={() => onQuickAction?.(action.id)}
                >
                  <span className="quick-action-icon">
                    <svg {...icon}>{action.icon}</svg>
                  </span>
                  <span className="quick-action-label">{action.label}</span>
                  <span className="quick-action-desc">
                    {action.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="dash-more-space"
            onClick={onViewPlans}
          >
            <span>
              <strong>¿Necesitas más espacio?</strong>
              <p>Consulta las opciones de almacenamiento de tu cuenta.</p>
            </span>
            <span className="dash-more-space-arrow">
              <svg {...icon} width="16" height="16">
                <path d="M5 12h14 M13 6l6 6-6 6" />
              </svg>
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}

export default function Dashboard({ user, initialData = null }) {
  const navigate = useNavigate();
  const [data, setData] = useState(
    initialData ? toDashboardProps(initialData) : null,
  );
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [folderError, setFolderError] = useState("");
  const [folderOpen, setFolderOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadStorage, setUploadStorage] = useState(null);

  useEffect(() => {
    if (initialData && revision === 0) return;
    let active = true;
    getDashboard()
      .then((result) => {
        if (active) {
          setData(toDashboardProps(result));
          setError("");
        }
      })
      .catch((error) => {
        if (active) {
          setError(error.message);
          setNotice({
            type: "error",
            message:
              "No se pudo actualizar el resumen de tu cuenta. Vuelve a intentarlo en unos momentos.",
          });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [revision, initialData]);

  const mutate = async (operation, message) => {
    if (busy) return;
    setBusy(true);
    try {
      await operation();
      setNotice({ type: "success", message });
      setFolderOpen(false);
      setFolderError("");
      setRevision((value) => value + 1);
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
  };
  const unavailable = () =>
    setNotice({
      type: "info",
      message: "Esta función estará disponible próximamente.",
    });
  const openUpload = () => {
    setUploadStorage(data?.storage ?? null);
    setUploadOpen(true);
  };

  const refresh = () => {
    setLoading(true);
    setRevision((value) => value + 1);
  };
  if (loading && !uploadOpen) return <Loading />;

  return (
    <>
      {error && (
        <div className="dash-feedback" role="alert">
          No se pudo actualizar el resumen. {error}
          <button type="button" onClick={refresh}>
            Reintentar
          </button>
        </div>
      )}
      {data ? (
        <DashboardHome
          {...data}
          user={user}
          busy={busy}
          onSearch={(value) =>
            navigate(`/archivos?search=${encodeURIComponent(value.trim())}`)
          }
          onUpload={openUpload}
          onQuickAction={(id) =>
            id === "upload"
              ? openUpload()
              : id === "folder"
                ? setFolderOpen(true)
                : id === "shared"
                  ? navigate("/compartidos")
                  : id === "plan" ? navigate("/plan") : unavailable()
          }
          onViewAllFiles={() => navigate("/archivos")}
          onViewPlans={() => navigate("/plan")}
        />
      ) : (
        !error && (
          <div className="dash-home" aria-busy="true">
            <section className="dash-hero">
              <div className="dash-hero-content">
                <h1>Hola, {user?.nombre}</h1>
                <p>
                  Aquí tienes un resumen de tu almacenamiento y archivos
                  recientes.
                </p>
              </div>
            </section>
          </div>
        )
      )}
      <Footer />
      {uploadOpen && (
        <ConnectedUploadModal
          storage={uploadStorage}
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
          onViewPlans={() => navigate("/plan")}
        />
      )}
      {folderOpen && (
        <CreateFolderModal
          isOpen
          isCreating={busy}
          errorMessage={folderError}
          onClose={() => {
            if (!busy) {
              setFolderOpen(false);
              setFolderError("");
            }
          }}
          onCreate={({ name, locationId }) =>
            mutate(
              () => createDashboardFolder(name, locationId),
              "Carpeta creada correctamente.",
            )
          }
        />
      )}
      <AlertModal
        variant="toast"

        autoClose
        autoCloseTime={notice?.type === "error" ? 7000 : 4500}
        isOpen={Boolean(notice)}
        type={notice?.type || "info"}
        title={
          notice?.type === "success"
            ? "Operación completada"
            : notice?.type === "error"
              ? "No se pudo completar la operación"
              : notice?.type === "warning"
                ? "Revisa la carga de archivos"
                : "Información"
        }
        message={notice?.message || ""}
        onClose={() => setNotice(null)}
      />
    </>
  );
}
