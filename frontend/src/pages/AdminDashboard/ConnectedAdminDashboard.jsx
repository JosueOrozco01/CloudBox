import { formatStorageBytes } from '../../utils/storageUsage';
import { activityLabel } from "../../utils/activityLabels";
import Footer from "../../components/FooterSignOut/Footer";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminDashboard from "./AdminDashboard";
import {
  getAdminOverview,
  getAdminActivity,
  mapAdminUser,
} from "../../services/adminService";
import Loading from "../../components/Loading/Loading";
import AlertModal from "../../components/AlertModal/AlertModal";

export default function ConnectedAdminDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [revision, setRevision] = useState(0);
  const activityLimit = 5;
  const [activityError, setActivityError] = useState("");
  const [logs, setLogs] = useState([]);
  useEffect(() => {
    let active = true;
    getAdminOverview()
      .then((overview) => {
        if (!active) return;
        setData(overview);
        setError("");
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [revision]);
  useEffect(() => {
    let active = true;
    let pending = false;
    const refreshActivity = async () => {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const result = await getAdminActivity(activityLimit);
        if (active) { setLogs(result.logs); setActivityError(""); }
      } catch (error) { if (active) setActivityError(error.message); }
      finally { pending = false; }
    };
    refreshActivity();
    const interval = setInterval(refreshActivity, 5000);
    window.addEventListener("focus", refreshActivity);
    window.addEventListener("admin-activity-changed", refreshActivity);
    document.addEventListener("visibilitychange", refreshActivity);
    return () => {
      active = false; clearInterval(interval);
      window.removeEventListener("focus", refreshActivity);
      window.removeEventListener("admin-activity-changed", refreshActivity);
      document.removeEventListener("visibilitychange", refreshActivity);
    };
  }, [activityLimit, revision]);
  if (!data && !error) return <Loading />;
  if (!data)
    return (
      <div className="admin-page" role="alert">
        {error}
        <button
          onClick={() => {
            setError("");
            setRevision((value) => value + 1);
          }}
        >
          Reintentar
        </button>
      </div>
    );
  const metrics = data.metrics;
  const percent = metrics.allocatedBytes
    ? (metrics.usedBytes / metrics.allocatedBytes) * 100
    : 0;
  const users = data.users.map(mapAdminUser);
  const activity = logs.map((log) => ({
    id: log.id,
    user:
      log.actorName || users.find((user) => user.id === log.id_usuario)?.name ||
      "Usuario no disponible",
    action: [activityLabel(log), log.targetName, log.resultDescription].filter(Boolean).join(" · "),
    date: new Date(log.fecha).toLocaleString("es-GT"),
    status: "Completado",
  }));
  const stats = [
    {
      id: "users",
      label: "Usuarios registrados",
      value: users.length.toLocaleString(),
      delta: `${users.filter((user) => new Date(user.fecha_registro) >= new Date(new Date().getFullYear(), new Date().getMonth(), 1)).length} registrados este mes`,
    },
    {
      id: "subs",
      label: "Suscripciones activas",
      value: metrics.activeSubscriptions.toLocaleString(),
      delta: `${users.length ? Number(((metrics.subscribedUsers / users.length) * 100).toFixed(1)) : 0}% de los usuarios tienen una suscripción activa`,
      deltaNeutral: true,
    },
    {
      id: "storage",
      label: "Almacenamiento utilizado",
      value: formatStorageBytes(metrics.usedBytes),
      usedBytes: metrics.usedBytes,
      totalBytes: metrics.allocatedBytes,
      progress: Math.min(100, percent),
      progressLabel: `${formatStorageBytes(metrics.usedBytes)} utilizados de ${formatStorageBytes(metrics.allocatedBytes)} asignados en planes`,
    },
    {
      id: "files",
      label: "Archivos almacenados",
      value: metrics.fileCount.toLocaleString(),
      delta: `${metrics.monthlyFiles} cargados este mes`,
    },
  ];
  const inspect = (id) => {
    if (id === "users") navigate("/admin/usuarios");
    else if (id === "storage") navigate("/admin/almacenamiento");
    else if (id === "subs") navigate("/admin/suscripciones");
    else if (id === "plans") navigate("/admin/planes");
    else navigate("/admin/metricas");
  };
  return (
    <>
      {activityError && <div className="admin-page" role="alert">No se pudo actualizar la actividad: {activityError}<button type="button" onClick={() => setRevision(value => value + 1)}>Reintentar</button></div>}
      <AdminDashboard
        stats={stats}
        activity={activity}
        systemAlert={
          percent >= 80
            ? "El consumo supera el 80 % del espacio asignado en los planes."
            : ""
        }
        planDistribution={metrics.planDistribution.map((plan, index) => ({
          ...plan,
          percent: metrics.activeSubscriptions
            ? (plan.count / metrics.activeSubscriptions) * 100
            : 0,
          color: ["#93c5fd", "#2563ff", "var(--plan-chart-third, #0b1a2e)"][index % 3],
        }))}
        subscriptionStatus={metrics.subscriptionStatus}
        topStorageUsers={users
          .filter((user) => user.usedBytes > 0 || user.maxBytes > 0)
          .map((user) => ({
            ...user,
            storagePercent:
              user.maxBytes > 0 ? (user.usedBytes / user.maxBytes) * 100 : null,
          }))
          .sort(
            (a, b) =>
              (b.storagePercent ?? -1) - (a.storagePercent ?? -1) ||
              b.usedBytes - a.usedBytes,
          )
          .slice(0, 5)}
        recentUsers={[...users]
          .sort(
            (a, b) => new Date(b.fecha_registro) - new Date(a.fecha_registro),
          )
          .slice(0, 5)}
        onManageUsers={() => inspect("users")}
        onReviewStorage={() => inspect("storage")}
        onQuickAction={inspect}
        onViewUserDetail={(user) =>
          navigate(`/admin/usuarios?detail=${user.id}`)
        }
        onViewAllActivity={() => navigate("/admin/notificaciones")}
      />
      <Footer />
      <AlertModal
        isOpen={Boolean(notice)}
        variant="toast"
        autoClose
        autoCloseTime={6000}
        type={notice?.type}
        title="Administración"
        message={notice?.message}
        onClose={() => setNotice(null)}
      />
    </>
  );
}
