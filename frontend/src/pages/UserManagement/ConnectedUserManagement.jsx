import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import UserManagement from "./UserManagement";
import Footer from "../../components/FooterSignOut/Footer";
import {
  getAdminOverview,
  mapAdminUser,
  updateUserRole,
  updateUserStatus,
} from "../../services/adminService";
import AdminUserModal from "../../components/AdminUserModal/AdminUserModal";
import AlertModal from "../../components/AlertModal/AlertModal";
import Loading from "../../components/Loading/Loading";

export default function ConnectedUserManagement({ user: currentUser }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({});
  const [filterTime] = useState(() => Date.now());
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState("");
  const [notice, setNotice] = useState(null);
  const [pendingStatus, setPendingStatus] = useState(null);
  const query = params.get("search") || "";
  useEffect(() => {
    let active = true;
    getAdminOverview()
      .then((result) => {
        if (active) {
          setData(result);
          setError("");
        }
      })
      .catch((error) => {
        if (!active) return;
        if (error.status === 401)
          navigate("/login", {
            replace: true,
            state: {
              alert: {
                type: "info",
                message: "Tu sesión venció. Inicia sesión nuevamente.",
              },
            },
          });
        else setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [revision, navigate]);
  if (!data && !error) return <Loading />;
  if (!data)
    return (
      <div className="um-page" role="alert">
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
  const users = data.users.map(mapAdminUser);
  const stats = [
    { id: "total", label: "Usuarios totales", value: users.length },
    {
      id: "active",
      label: "Usuarios activos",
      value: users.filter((user) => user.status === "Activo").length,
    },
    {
      id: "pending",
      label: "Pendientes",
      value: users.filter((user) => user.status === "Pendiente").length,
    },
    {
      id: "inactive",
      label: "Inactivos / Suspendidos",
      value: users.filter((user) =>
        ["Inactivo", "Suspendido"].includes(user.status),
      ).length,
    },
  ];
  const filtered = users
    .filter(
      (user) =>
        `${user.name} ${user.email}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (!filters.plan || user.plan === filters.plan) &&
        (!filters.status || user.status === filters.status) &&
        (!filters.days ||
          new Date(user.fecha_registro).getTime() >=
            filterTime - Number(filters.days) * 86400000),
    )
    .sort((a, b) =>
      filters.sort === "name"
        ? a.name.localeCompare(b.name)
        : filters.sort === "storage"
          ? b.usedBytes - a.usedBytes
          : new Date(b.fecha_registro) - new Date(a.fecha_registro),
    );
  const totalPages = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, totalPages);
  const selected =
    modal?.user ||
    users.find((user) => String(user.id) === params.get("detail"));
  const mode = modal?.mode || (selected ? "detail" : null);
  const close = () => {
    setModal(null);
    setModalError("");
    const next = new URLSearchParams(params);
    next.delete("detail");
    setParams(next, { replace: true });
  };
  const changeStatus = async () => {
    if (busy || !pendingStatus) return;
    setBusy(true);
    try {
      await updateUserStatus(pendingStatus.user.id, pendingStatus.state.id);
      setNotice({
        type: "success",
        tone: pendingStatus.state.nombre === "Activo" ? "success" : "error",
        message: `El estado de ${pendingStatus.user.name} se actualizó a ${pendingStatus.state.nombre.toLowerCase()}.`,
      });
      setPendingStatus(null);
      setRevision((value) => value + 1);
    } catch (error) {
      setPendingStatus(null);
      setNotice({ type: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {error && (
        <div className="um-page" role="alert">
          {error}
          <button onClick={() => setRevision((value) => value + 1)}>
            Reintentar
          </button>
        </div>
      )}
      <UserManagement
        stats={stats}
        users={filtered.slice((currentPage - 1) * 10, currentPage * 10)}
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={filtered.length}
        query={query}
        filters={filters}
        plans={[...new Set(users.map((user) => user.plan))]}
        onPageChange={setPage}
        onSearch={(value) => {
          setPage(1);
          const next = new URLSearchParams(params);
          if (value) next.set("search", value);
          else next.delete("search");
          setParams(next, { replace: true });
        }}
        onFilterChange={(key, value) => {
          setFilters((previous) => ({ ...previous, [key]: value }));
          setPage(1);
        }}
        onViewUserDetail={(user) => {
          setModalError("");
          setModal({ mode: "detail", user });
        }}
        onEditUser={(user) => {
          if (user.id === currentUser.id) {
            setNotice({
              type: "warning",
              message:
                "No puedes modificar tus propios permisos administrativos.",
            });
            return;
          }
          setModalError("");
          setModal({ mode: "edit", user });
        }}
        onToggleUserStatus={(user) => {
          if (user.id === currentUser.id) {
            setNotice({
              type: "warning",
              message: "No puedes modificar el estado de tu propia cuenta.",
            });
            return;
          }
          const state =
            user.status === "Activo"
              ? data.states.find((state) => state.nombre === "Suspendido") ||
                data.states.find((state) => state.nombre === "Inactivo")
              : data.states.find((state) => state.nombre === "Activo");
          if (!state) {
            setNotice({
              type: "error",
              message:
                "El estado requerido no está disponible en el catálogo de usuarios.",
            });
            return;
          }
          setPendingStatus({ user, state });
        }}
      />
      <Footer />
      {mode && (
        <AdminUserModal
          key={`${mode}-${selected?.id || "new"}`}
          mode={mode}
          user={selected}
          roles={data.roles}
          busy={busy}
          error={modalError}
          onClose={close}
          onSubmit={async (form) => {
            if (busy) return;
            setBusy(true);
            setModalError("");
            try {
              await updateUserRole(selected.id, Number(form.id_rol));
              close();
              setRevision((value) => value + 1);
              setNotice({
                type: "success",
                message:
                  "Los permisos del usuario se actualizaron correctamente.",
              });
            } catch (error) {
              setModalError(error.message);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
      <AlertModal
        isOpen={Boolean(pendingStatus)}
        type="warning"
        title="Confirmar cambio de estado"
        message={
          pendingStatus
            ? `¿Deseas cambiar el estado de ${pendingStatus.user.name} a ${pendingStatus.state.nombre.toLowerCase()}?`
            : ""
        }
        confirmText="Confirmar"
        cancelText="Cancelar"
        onConfirm={changeStatus}
        onClose={() => {
          if (!busy) setPendingStatus(null);
        }}
      />
      <AlertModal
        variant="toast"
        autoClose
        autoCloseTime={6000}
        isOpen={Boolean(notice)}
        type={notice?.type}
        tone={notice?.tone || notice?.type}
        title="Gestión de usuarios"
        message={notice?.message}
        onClose={() => setNotice(null)}
      />
    </>
  );
}
