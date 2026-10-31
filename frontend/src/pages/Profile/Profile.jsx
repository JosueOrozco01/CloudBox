import { ArrowRight, LifeBuoy, LogOut, Settings2, ShieldAlert, ShieldCheck, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { Modal } from "../../components/ModuleUI/ModuleUI";
import Footer from "../../components/FooterSignOut/Footer";
import ProfileHero from "./ProfileHero";
import SecurityTab from "../SecurityTab/Securitytab";
import PreferencesTab from "../Preferencestab/Preferencetab";
import { getPreferences, getSecurity, savePreferences, changePassword, logoutOtherSessions } from "../../services/settingsService";
import { applyPreferences } from "../../utils/preferences";
import { useEffect, useState } from "react";
import ProfileForm from "./ProfileForm.jsx";
import StorageSummary from "./StorageSummary.jsx";
import { getMyProfile, deactivateMyAccount } from "../../services/profileService.js";
import { useNavigate, useSearchParams } from "react-router-dom";
import { logout, clearSession } from "../../services/authService";
import Loading from "../../components/Loading/Loading";
import AlertModal from "../../components/AlertModal/AlertModal";
import "./Profile.css";
import "./ProfileRefresh.css";

function UserProfile() {
  const [sessionToken] = useState(() => localStorage.getItem('token'));
  const [params, setParams] = useSearchParams();
  const tab = ['seguridad', 'preferencias'].includes(params.get('tab')) ? params.get('tab') : 'perfil';
  const [preferences, setPreferences] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [passwordError, setPasswordError] = useState('');
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
      const result = await logout();
      if (result?.sessionChanged) return;
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
      if (!clearSession(sessionToken)) return;

      setDeletePassword("");
      setShowDeleteConfirm(false);

      navigate("/login", { replace: true });
    } catch (error) {
      setDeleteError(error.message || "No se pudo desactivar la cuenta");
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
    let active = true;
    const currentSession = () => active && sessionToken === localStorage.getItem("token");
    const loadProfile = async () => {
      try {
        const [profile, saved, security] = await Promise.all([getMyProfile(), getPreferences(), getSecurity()]);
        if (!currentSession()) return;
        setUser(profile); setPreferences(saved); setSessions(security.sessions);
        applyPreferences(profile.id, saved, sessionToken);
      } catch (error) {
        if (currentSession()) setError(error.message);
      } finally {
        if (currentSession()) setIsLoading(false);
      }
    };

    loadProfile();
    return () => { active = false; };
  }, [sessionToken]);

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
          <h1>Mi perfil</h1>
          <p>Un espacio para tus datos, tu seguridad y tus preferencias.</p>
        </header>

        <ProfileHero user={user} />
        <div className="profileContent">
          <aside className="account-sidebar"><nav className="profileTabs" aria-label="Configuración de cuenta"><span className="account-nav-caption">CONFIGURACIÓN</span>{[['perfil', 'Perfil', 'Tu información personal', UserRound], ['seguridad', 'Seguridad', 'Contraseña y sesiones', ShieldCheck], ['preferencias', 'Preferencias', 'Un espacio a tu estilo', Settings2]].map(([id, label, description, Icon]) => <button key={id} className={`profileTab ${tab === id ? 'profileTabActive' : ''}`} onClick={() => setParams(id === 'perfil' ? {} : { tab: id })} aria-pressed={tab === id} aria-label={label} type="button"><span className="account-tab-icon"><Icon size={19} /></span><span>{label}<small>{description}</small></span><ArrowRight size={14} className="account-tab-arrow" /></button>)}</nav><div className="account-sidebar-help"><LifeBuoy size={23} /><h2>Estamos para ayudarte</h2><p>Encuentra respuestas sobre tu cuenta y tu espacio.</p><Link to="/soporte">Ir al centro de ayuda<ArrowRight size={14} /></Link></div></aside>

          <section className="profilePanels">
            {tab === 'seguridad' && <SecurityTab sessions={sessions} isUpdatingPassword={settingsBusy} passwordError={passwordError} onUpdatePassword={async values => {
              setSettingsBusy(true); setPasswordError('');
              try { await changePassword(values); showAlert('success', 'Seguridad', 'Contraseña actualizada correctamente.'); return true; }
              catch (error) { setPasswordError(error.message); return false; }
              finally { setSettingsBusy(false); }
            }} onLogoutOtherSessions={async () => {
              if (settingsBusy) return;
              setSettingsBusy(true);
              try { const result = await logoutOtherSessions(); setSessions((await getSecurity()).sessions); showAlert('success', 'Sesiones', result.message); }
              catch (error) { showAlert('error', 'Sesiones', error.message); }
              finally { setSettingsBusy(false); }
            }} onLogout={handleLogout} onDeleteAccount={() => setShowDeleteConfirm(true)} />}
            {tab === 'preferencias' && preferences && <PreferencesTab userId={user.id} initialNotifications={preferences.notifications} initialTheme={preferences.theme} initialLanguage={preferences.language} initialShowKB={preferences.showKB} isSaving={settingsBusy} onSavePreferences={async values => {
              if (settingsBusy) return;
              setSettingsBusy(true);
              try { const saved = await savePreferences(values); setPreferences(saved); applyPreferences(user.id, saved, sessionToken); showAlert('success', 'Preferencias', 'Preferencias guardadas correctamente.'); }
              catch (error) { showAlert('error', 'Preferencias', error.message); }
              finally { setSettingsBusy(false); }
            }} onLogout={handleLogout} onDeleteAccount={() => setShowDeleteConfirm(true)} />}
            {tab === 'perfil' && <>

            <ProfileForm 
              user={user}
              onProfileUpdated={(updatedUser) => {
                setUser(updatedUser);
              }}
              />

            <StorageSummary isAdmin={user.permissions?.includes("admin_panel")} />

            <section className="profilePanel profileAccountPanel">
              <div className="profilePanelHeading">
                <h2><LogOut size={20} />Tu cuenta</h2>
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

            </>}
          </section>
        </div>
      </main>
      <Footer />
      {showDeleteConfirm && <Modal title="Desactivar cuenta" subtitle="Revisa esta decisión antes de continuar" icon={ShieldAlert} busy={isDeleting} onClose={() => { setShowDeleteConfirm(false); setDeletePassword(''); setDeleteError(''); setShowDeletePassword(false); }}><form className="module-form account-deactivate-form" onSubmit={event => { event.preventDefault(); handleDeactivateAccount(); }}><div className="account-deactivate-note"><ShieldAlert size={20} /><p>Perderás el acceso a CloudBox. Tus archivos, carpetas y datos permanecerán almacenados.</p></div><label className="module-field" htmlFor="deletePassword">Confirma con tu contraseña actual<div className="account-password-wrap"><input id="deletePassword" type={showDeletePassword ? 'text' : 'password'} value={deletePassword} onChange={event => setDeletePassword(event.target.value)} placeholder="Contraseña actual" autoComplete="current-password" disabled={isDeleting} required /><button type="button" disabled={isDeleting} onClick={() => setShowDeletePassword(!showDeletePassword)} aria-label={showDeletePassword ? 'Ocultar contraseña de confirmación' : 'Mostrar contraseña de confirmación'}>{showDeletePassword ? 'Ocultar' : 'Mostrar'}</button></div></label>{deleteError && <p className="deleteAccountError" role="alert">{deleteError}</p>}<div className="module-actions"><button className="module-button" type="button" onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); setDeleteError(''); setShowDeletePassword(false); }} disabled={isDeleting}>Cancelar</button><button className="module-button danger" type="submit" disabled={isDeleting || !deletePassword.trim()}>{isDeleting ? 'Desactivando...' : 'Confirmar desactivación'}</button></div></form></Modal>}

      {(isLoggingOut || isDeleting || settingsBusy) && <Loading text={isLoggingOut ? "Cerrando sesión" : "Guardando cambios"} fullScreen={false} />}

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