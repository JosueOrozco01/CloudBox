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
  const [logs, setLogs] = useState([]);
  useEffect(() => {
    let active = true;
    Promise.all([getAdminOverview(), getAdminActivity(5)])
      .then(([overview, activity]) => {
        if (!active) return;
        setData(overview);
        setLogs(activity.logs);
        setError("");
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [revision]);
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
  const usedGB = metrics.usedBytes / 1024 ** 3;
  const allocatedGB = metrics.allocatedBytes / 1024 ** 3;
  const percent = allocatedGB
    ? (metrics.usedBytes / metrics.allocatedBytes) * 100
    : 0;
  const users = data.users.map(mapAdminUser);
  const activity = logs.map((log) => ({
    id: log.id,
    user:
      users.find((user) => user.id === log.id_usuario)?.name ||
      "Usuario no disponible",
    action: log.accion.replaceAll("_", " ").toLowerCase(),
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
      value: `${usedGB.toFixed(2)} GB`,
      progress: Math.min(100, percent),
      progressLabel: `${usedGB.toFixed(2)} GB utilizados de ${allocatedGB.toFixed(2)} GB asignados en planes`,
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
    else if (id === "storage")
      setNotice({
        type: "info",
        message: `Se utilizan ${usedGB.toFixed(2)} GB de ${allocatedGB.toFixed(2)} GB asignados en planes. Incluye archivos en papelera; no representa la capacidad física del servidor.`,
      });
    else if (id === "subs" || id === "plans")
      setNotice({
        type: "info",
        message: `Hay ${metrics.activeSubscriptions} suscripciones vigentes. La distribución por plan está disponible en este panel; aún no existe una API para modificar planes o suscripciones.`,
      });
    else
      setNotice({
        type: "info",
        message: `Usuarios: ${users.length}. Archivos almacenados: ${metrics.fileCount}. Uso de almacenamiento: ${usedGB.toFixed(2)} GB.`,
      });
  };
  return (
    <>
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
          color: ["#93c5fd", "#2563ff", "#0b1a2e"][index % 3],
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
        onViewAllActivity={async () => {
          try {
            const result = await getAdminActivity(100, logs.length);
            const combined = [
              ...new Map(
                [...logs, ...result.logs].map((log) => [log.id, log]),
              ).values(),
            ];
            setLogs(combined);
            setNotice({
              type: "info",
              message: `Se muestran los últimos ${combined.length} registros de ${result.total} eventos de auditoría.`,
            });
          } catch (error) {
            setNotice({ type: "error", message: error.message });
          }
        }}
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
