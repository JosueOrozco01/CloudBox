import { getPreferences } from "./services/settingsService";
import { applyPreferences } from "./utils/preferences";
import SharedPage from "./pages/Compratidoconmigo/ConnectedCompartidos";
import UserManagement from "./pages/UserManagement/ConnectedUserManagement";
import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import LoginPage from "./pages/Login/LoginPage";
import RegisterPage from "./pages/Register/Register";
import ForgotPassword from "./pages/RecoverPassword/Recover";
import Dashboard from "./pages/Dashboard/Dashboard";
import Papelera from "./pages/Papelera/Papelera";
import FilesPage from "./pages/Misarchivos/Misarchivos";
import AdminDashboard from "./pages/AdminDashboard/ConnectedAdminDashboard";
import OfflineBanner from "./components/OfflineBanner/Offline";
import LandingPage from "./pages/LandingPage/LandingPage";
import UserProfile from "./pages/Profile/Profile";
import Terms from "./pages/Terms/Terms";
import Privacy from "./pages/Privacy/Privacy";
import Cookies from "./pages/Cookies/Cookies";
import AppTopbar from "./components/Apptopbar/Apptopbar";
import Loading from "./components/Loading/Loading";
import { getMyProfile } from "./services/profileService";
import { getDashboard } from "./services/dashboardService";

function AuthenticatedPage({
  children,
  requiredPermission = null,
  clientOnly = false,
  preloadDashboard = false,
}) {
  const location = useLocation();

  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);

  useEffect(() => {
    let active = true;

    const loadUser = async () => {
      setIsLoading(true);
      setProfileError(null);

      try {
        const profile = await getMyProfile();
        const preferences = await getPreferences().catch(() => null);
        if (active && preferences) applyPreferences(profile.id, preferences);
        const summary =
          preloadDashboard && !profile.permissions?.includes("admin_panel")
            ? await getDashboard().catch(() => null)
            : null;

        if (active) {
          setUser(profile);
          setDashboardData(summary);
        }
      } catch (error) {
        console.error("Error al obtener usuario:", error);

        if (active) {
          setUser(null);
          setProfileError(error);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    loadUser();

    return () => {
      active = false;
    };
  }, [preloadDashboard]);

  if (isLoading) {
    return <Loading text="Cargando..." />;
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location,
          alert: {
            type: "error",
            title:
              profileError?.status === 401
                ? "Sesión no válida"
                : "No se pudo acceder a tu cuenta",
            message:
              profileError?.message ||
              "No se pudo obtener la información de tu cuenta. Inténtalo nuevamente.",
          },
        }}
      />
    );
  }

  const permissions = Array.isArray(user.permissions) ? user.permissions : [];

  if (clientOnly && permissions.includes("admin_panel")) {
    return <Navigate to="/admin" replace />;
  }

  if (requiredPermission && !permissions.includes(requiredPermission)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <>
      <AppTopbar user={user} />
      {typeof children === "function"
        ? children(user, dashboardData)
        : children}
    </>
  );
}

function InformationalPage({ component: Page }) {
  return localStorage.getItem('token')
    ? <AuthenticatedPage><Page embedded /></AuthenticatedPage>
    : <Page />;
}
function RecoveryPage() {
  return localStorage.getItem('token') ? <Navigate to="/perfil?tab=seguridad" replace /> : <ForgotPassword />;
}

function App() {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => {
      if (document.documentElement.dataset.themeMode === 'sistema') document.documentElement.dataset.theme = media.matches ? 'dark' : 'light';
    };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return (
    <BrowserRouter>
      <OfflineBanner />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<RegisterPage />} />
        <Route path="/recuperar" element={<RecoveryPage />} />
        <Route
          path="/dashboard"
          element={
            <AuthenticatedPage key="dashboard" clientOnly preloadDashboard>
              {(user, initialData) => (
                <Dashboard user={user} initialData={initialData} />
              )}
            </AuthenticatedPage>
          }
        />
        <Route
          path="/archivos"
          element={
            <AuthenticatedPage key="files" clientOnly>
              {(user) => <FilesPage user={user} />}
            </AuthenticatedPage>
          }
        />
        <Route path="/compartidos" element={<AuthenticatedPage key="shared" clientOnly>{(user) => <SharedPage user={user} />}</AuthenticatedPage>} />
        <Route
          path="/papelera"
          element={
            <AuthenticatedPage key="trash" clientOnly>
              {(user) => <Papelera user={user} />}
            </AuthenticatedPage>
          }
        />
        <Route
          path="/admin"
          element={
            <AuthenticatedPage requiredPermission="admin_panel">
              <AdminDashboard />
            </AuthenticatedPage>
          }
        />
        <Route
          path="/admin/usuarios"
          element={
            <AuthenticatedPage
              key="admin-users"
              requiredPermission="manage_users"
            >
              {(user) => <UserManagement user={user} />}
            </AuthenticatedPage>
          }
        />
        <Route
          path="/perfil"
          element={
            <AuthenticatedPage>
              <UserProfile />
            </AuthenticatedPage>
          }
        />
        <Route path="/terminos" element={<InformationalPage component={Terms} />} />
        <Route path="/privacidad" element={<InformationalPage component={Privacy} />} />
        <Route path="/cookies" element={<InformationalPage component={Cookies} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
