import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import UserManagement from "./UserManagement";
import Footer from "../../components/FooterSignOut/Footer";
import {
  getAdminUsers, getAdminUser, getUserCatalog,
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
  const [catalog,setCatalog]=useState(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({});
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState("");
  const [notice, setNotice] = useState(null);
  const [pendingStatus, setPendingStatus] = useState(null);
  const query = params.get("search") || "";
  useEffect(() => {
    let active = true;
    getAdminUsers({page,limit:10,search:query,...filters}).then(result=>({users:result.data,pagination:result.pagination}))
      .then((result) => {
        if (active) {
          if(page>Math.max(1,result.pagination.totalPages)){setPage(Math.max(1,result.pagination.totalPages));return;}
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
  }, [revision, navigate, page, query, filters]);
  useEffect(()=>{let active=true;getUserCatalog().then(result=>{if(active)setCatalog(result);}).catch(error=>{if(active)setError(error.message);});return()=>{active=false;};},[revision]);
  const detailId=params.get('detail');
  useEffect(()=>{
    if(!detailId)return;
    let active=true;
    getAdminUser(detailId).then(user=>{if(active)setModal({mode:'detail',user:mapAdminUser(user)});}).catch(error=>{if(active)setNotice({type:'error',message:error.message});});
    return ()=>{active=false;};
  },[detailId,revision]);
  if ((!data || !catalog) && !error) return <Loading />;
  if (!data || !catalog)
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
  const stats = catalog.stats;
  const totalPages = Math.max(1,data.pagination.totalPages);
  const currentPage = Math.min(page,totalPages);
  const selected = modal?.user;
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
        users={users}
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={data.pagination.totalRecords}
        query={query}
        filters={filters}
        plans={catalog.plans}
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
        onViewUserDetail={async (user) => {
          try { setModalError(''); setModal({mode:'detail',user:mapAdminUser(await getAdminUser(user.id))}); }
          catch(error) { setNotice({type:'error',message:error.message}); }
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
              ? catalog.states.find((state) => state.nombre === "Suspendido") ||
                catalog.states.find((state) => state.nombre === "Inactivo")
              : catalog.states.find((state) => state.nombre === "Activo");
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
          roles={catalog.roles}
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
