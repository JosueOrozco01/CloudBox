import Loading from "../Loading/Loading";
import { activityLabel as label } from "../../utils/activityLabels";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  CheckCheck,
  Activity,
  X,
  UserRound,
  CalendarDays,
  FileText,
} from "lucide-react";
import { getAdminActivity } from "../../services/adminService";
import "../CreateFolderModal/Createfoldermodal.css";
import "../AdminUserModal/AdminUserModal.css";
import "./AdminNotifications.css";

const date = (log) =>
  log.fecha
    ? new Date(log.fecha).toLocaleString("es-GT")
    : "Fecha no disponible";

export default function AdminNotifications({ userId }) {
  const storageKey = `cloudbox:notifications:read:${userId}`;
  const [read, setRead] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  const [logs, setLogs] = useState([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  useEffect(() => {
    let active = true;
    let pending = false;
    const refresh = async () => {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const result = await getAdminActivity(100);
        if (active) {
          setLogs(result.logs);
          setError("");
        }
      } catch {
        if (active) setError("No se pudo actualizar la actividad.");
      } finally {
        pending = false;
        if (active) setLoading(false);
      }
    };
    refresh();
    const interval = setInterval(refresh, 5000);
    window.addEventListener("admin-activity-changed", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("admin-activity-changed", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [userId, revision]);
  useEffect(() => {
    const outside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target))
        setOpen(false);
    };
    const escape = (event) => {
      if (event.key === "Escape") {
        setSelected(null);
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  const markRead = (ids) => {
    const next = [...new Set([...read, ...ids])].slice(-1000);
    setRead(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* Se conservan durante la sesión. */
    }
  };
  const unread = logs.filter((log) => !read.includes(log.id)).length;
  return (
    <>
      <div className="admin-notifications" ref={rootRef}>
        <button
          ref={triggerRef}
          type="button"
          className="app-notification-button"
          aria-label={`Notificaciones: ${unread} sin leer`}
          aria-expanded={open}
          aria-controls="admin-notification-panel"
          onClick={() => setOpen((value) => !value)}
        >
          <Bell size={20} />
          {unread > 0 && (
            <span className="admin-notification-count">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
        {open && (
          <section
            id="admin-notification-panel"
            className="admin-notification-panel"
            aria-label="Notificaciones de actividad"
          >
            <header>
              <div>
                <h2>Actividad reciente</h2>
                <p>
                  {unread
                    ? `${unread} notificaciones sin leer`
                    : "Estás al día"}
                </p>
              </div>
              <button
                type="button"
                title="Marcar todas como leídas"
                aria-label="Marcar todas como leídas"
                disabled={!unread}
                onClick={() => markRead(logs.map((log) => log.id))}
              >
                <CheckCheck size={20} />
              </button>
            </header>
            {error && (
              <p className="admin-notification-feedback" role="alert">
                {error}{" "}
                <button
                  type="button"
                  onClick={() => setRevision((value) => value + 1)}
                >
                  Reintentar
                </button>
              </p>
            )}
            {loading && (
              <Loading inline text="Cargando actividad…" />
            )}
            {!loading && !error && !logs.length && (
              <p className="admin-notification-feedback">
                No hay actividad registrada.
              </p>
            )}
            <ul>
              {logs.map((log) => (
                <li key={log.id}>
                  <button
                    type="button"
                    className={!read.includes(log.id) ? "unread" : ""}
                    onClick={() => {
                      markRead([log.id]);
                      setSelected(log);
                      setOpen(false);
                    }}
                  >
                    <span className="admin-notification-icon">
                      <Activity size={18} />
                    </span>
                    <span>
                      <strong>{label(log)}</strong>
                      <span>
                        {log.actorName || `Usuario #${log.id_usuario}`}
                        {log.targetName ? ` · ${log.targetName}` : ""}
                      </span>
                      <time>{date(log)}</time>
                    </span>
                    {!read.includes(log.id) && <i aria-label="Sin leer" />}
                  </button>
                </li>
              ))}
            </ul>
            <footer>Últimos 100 eventos · actualización automática</footer>
          </section>
        )}
      </div>
      {selected && (
        <div className="cf-backdrop" onClick={() => setSelected(null)}>
          <section
            className="cf-modal admin-notification-detail"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="cf-header">
              <span className="cf-header-icon">
                <Activity size={20} />
              </span>
              <div className="cf-header-text">
                <h2 id="notification-detail-title">Detalle de actividad</h2>
                <p>{label(selected)}</p>
              </div>
              <button
                autoFocus
                className="admin-notification-dismiss"
                type="button"
                aria-label="Cerrar detalle"
                onClick={() => setSelected(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="cf-body">
              <dl className="admin-user-details">
                <div>
                  <dt>
                    <UserRound size={15} />
                    Realizada por
                  </dt>
                  <dd>
                    {selected.actorName || `Usuario #${selected.id_usuario}`}
                  </dd>
                </div>
                <div>
                  <dt>
                    <CalendarDays size={15} />
                    Fecha y hora
                  </dt>
                  <dd>{date(selected)}</dd>
                </div>
                <div>
                  <dt>
                    <FileText size={15} />
                    Acción
                  </dt>
                  <dd>{label(selected)}</dd>
                </div>
                <div>
                  <dt>
                    <UserRound size={15} />
                    Elemento afectado
                  </dt>
                  <dd>
                    {selected.targetName ||
                      selected.entidad_afectada ||
                      "No especificado"}
                  </dd>
                </div>
                {selected.resultDescription && (
                  <div>
                    <dt>
                      <CheckCheck size={15} />
                      Resultado
                    </dt>
                    <dd>{selected.resultDescription}</dd>
                  </div>
                )}
              </dl>
            </div>
            <div className="cf-footer">
              <button
                className="cf-create-btn"
                type="button"
                onClick={() => {
                  setSelected(null);
                  triggerRef.current?.focus();
                }}
              >
                Cerrar
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
