import { useEffect, useState } from "react";
import ProfileForm from "./ProfileForm.jsx";
import StorageSummary from "./StorageSummary.jsx";
import { getMyProfile, deactivateMyAccount } from "../../services/profileService.js";
import { useNavigate } from "react-router-dom";
import { logout } from "../../services/authService";
import Loading from "../../components/Loading/Loading";
import AlertModal from "../../components/AlertModal/AlertModal";
import "./Profile.css";

function UserProfile() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [alert, setAlert] = useState({
    isOpen: false,
    type: "success",
    title: "",
    message: ""
  });

  const navigate = useNavigate();

  const showAlert = (type, title, message) => {
    setAlert({
      isOpen: true,
      type,
      title,
      message
    });
  };

  const closeAlert = () => {
    setAlert((prev) => ({
      ...prev,
      isOpen: false
    }));
  };

  // Cerrar sesión
  const handleLogout = async () => {
    if (isLoggingOut || isDeleting) return;

    setIsLoggingOut(true);

    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      showAlert(
        "error",
        "Error al cerrar sesión",
        "No se pudo cerrar sesión. Inténtalo nuevamente."
      );
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleDeactivateAccount = async () => {
    if (isDeleting || isLoggingOut) return;

    if (!deletePassword.trim()) {
      setDeleteError("Debes ingresar tu contraseña actual");
      return;
    }

    setIsDeleting(true);
    setDeleteError("");

    try {
      await deactivateMyAccount(deletePassword);

      // La cuenta ya está inactiva en la base de datos.
      // Limpiar la sesión local aunque el endpoint de logout
      // rechace el token por el nuevo estado del usuario.
      localStorage.removeItem("token");

      setDeletePassword("");
      setShowDeleteConfirm(false);

      navigate("/login", { replace: true });
    } catch (error) {
      showAlert(
        "error",
        "Error al desactivar cuenta",
        error.message || "No se pudo desactivar la cuenta"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // Cargar perfil
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profile = await getMyProfile();
        setUser(profile);
      } catch (error) {
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, []);

  if (isLoading) {
    return (
      <div className="profilePage">
        <main className="profileMain">
          <Loading />
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profilePage">
        <main className="profileMain">
          <p>{error}</p>
        </main>
      </div>
    );
  }

  return (
    <div className="profilePage">
      <main className="profileMain">
        <header className="profilePageHeader">
          <h1>Configuración</h1>
          <p>Administra tu perfil, seguridad y preferencias de CloudBox</p>
        </header>

        <div className="profileContent">
          <aside
            className="profileTabs"
            aria-label="Configuración de cuenta"
          >
            <button
              className="profileTab profileTabActive"
              type="button"
            >
              <img
                className="profileTabIcon"
                src="/Usuario.png"
                alt=""
              />
              Perfil
            </button>

            <button className="profileTab" type="button">
              <img
                className="profileTabIcon"
                src="/seguro.png"
                alt=""
              />
              Seguridad
            </button>

            <button className="profileTab" type="button">
              <img
                className="profileTabIcon"
                src="/preferencias.png"
                alt=""
              />
              Preferencias
            </button>
          </aside>

          <section className="profilePanels">

            <ProfileForm 
              user={user}
              onProfileUpdated={(updatedUser) => {
                setUser(updatedUser);
              }}
              />

            <StorageSummary />

            <section className="profilePanel profileAccountPanel">
              <div className="profilePanelHeading">
                <h2>Cuenta</h2>
                <p>
                  Si cierras sesión tendrás que ingresar tus credenciales
                  nuevamente. Si decides desactivar tu cuenta, perderás
                  el acceso a CloudBox, pero tus archivos y datos se conservarán.
                </p>
              </div>

              <div className="profileAccountActions">
                <button
                  className="secondaryButton"
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut || isDeleting}
                >
                  {isLoggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
                </button>

                <button
                  className="dangerButton"
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isDeleting || isLoggingOut}
                >
                  Desactivar cuenta
                </button>
              </div>
            </section>

          </section>
        </div>
      </main>
      {showDeleteConfirm && (
        <div className="deleteAccountOverlay">
          <div
            className="deleteAccountModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="deleteAccountTitle"
          >
            <h2 id="deleteAccountTitle">
              Desactivar cuenta
            </h2>

            <p>
              Tu cuenta será desactivada y perderás el acceso a CloudBox.
              Tus archivos, carpetas y datos permanecerán almacenados.
              Ingresa tu contraseña para confirmar esta acción.
            </p>

            <label
              className="deletePasswordLabel"
              htmlFor="deletePassword"
            >
              Ingresa tu contraseña actual
            </label>

            <div className="deletePasswordField">
              <input
                id="deletePassword"
                type={showDeletePassword ? "text" : "password"}
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Contraseña actual"
                autoComplete="current-password"
                disabled={isDeleting}
              />

              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowDeletePassword(!showDeletePassword)}
              >
                {showDeletePassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>

            {deleteError && (
              <p className="deleteAccountError" role="alert">
                {deleteError}
              </p>
            )}

            <div className="deleteAccountActions">
              <button
                className="secondaryButton"
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletePassword("");
                  setDeleteError("");
                  setShowDeletePassword(false);
                }}
                disabled={isDeleting}
              >
                Cancelar
              </button>

              <button
                className="dangerButton"
                type="button"
                onClick={handleDeactivateAccount}
                disabled={isDeleting || !deletePassword.trim()}
              >
                {isDeleting ? "Desactivando..." : "Confirmar desactivación"}
              </button>
            </div>
          </div>
        </div>
      )}

      {(isLoggingOut || isDeleting) && <Loading />}

      <AlertModal
        isOpen={alert.isOpen}
        onClose={closeAlert}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        variant="toast"
        autoClose={true}
        autoCloseTime={3000}
      />
    </div>
  );
}

export default UserProfile;