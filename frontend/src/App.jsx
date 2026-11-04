


import { getPreferences } from "./services/settingsService";
import { applyPreferences, beginAccountAppearance, restoreCachedPreferences } from "./utils/preferences";


import { lazy, Suspense, useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";







import OfflineBanner from "./components/OfflineBanner/Offline";





import AppTopbar from "./components/Apptopbar/Apptopbar";
import Loading from "./components/Loading/Loading";
import PageBoundary from './components/PageBoundary';
import { getMyProfile } from "./services/profileService";
import { getDashboard } from "./services/dashboardService";











const VerifyEmail = lazy(() => import('./pages/Register/VerifyEmail'));
const TicketCenter = lazy(() => import('./pages/Support/TicketCenter'));
const Product = lazy(() => import('./pages/Product/Product'));
const SharedPage = lazy(() => import('./pages/Compratidoconmigo/ConnectedCompartidos'));
const UserManagement = lazy(() => import('./pages/UserManagement/ConnectedUserManagement'));
const LoginPage = lazy(() => import('./pages/Login/LoginPage'));
const RegisterPage = lazy(() => import('./pages/Register/Register'));
const ForgotPassword = lazy(() => import('./pages/RecoverPassword/Recover'));
const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'));
const Papelera = lazy(() => import('./pages/Papelera/Papelera'));
const FilesPage = lazy(() => import('./pages/Misarchivos/Misarchivos'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard/ConnectedAdminDashboard'));
const LandingPage = lazy(() => import('./pages/LandingPage/LandingPage'));
const UserProfile = lazy(() => import('./pages/Profile/Profile'));
const Terms = lazy(() => import('./pages/Terms/Terms'));
const Privacy = lazy(() => import('./pages/Privacy/Privacy'));
const Cookies = lazy(() => import('./pages/Cookies/Cookies'));
const Plans = lazy(() => import('./pages/Plans/Plans'));
const Payments = lazy(() => import('./pages/Payments/Payments'));
const Activity = lazy(() => import('./pages/Activity/Activity'));
const Notifications = lazy(() => import('./pages/Notifications/Notifications'));
const AdminNotificationInbox = lazy(() => import('./pages/Notifications/AdminNotificationInbox'));
const Support = lazy(() => import('./pages/Support/Support'));
const AdminPlans = lazy(() => import('./pages/AdminPlans/AdminPlans'));
const AdminSubscriptions = lazy(() => import('./pages/AdminSubscriptions/AdminSubscriptions'));
const AdminStorage = lazy(() => import('./pages/AdminStorage/AdminStorage'));
const AdminReports = lazy(() => import('./pages/AdminReports/AdminReports'));

function AuthenticatedPage({
  children,
  requiredPermission = null,
  clientOnly = false,
  preloadDashboard = false,
}) {
  const location = useLocation();

  const [user, setUser] = useState(null);
  const [profileRevision,setProfileRevision]=useState(0);
  useEffect(()=>{const sync=()=>setProfileRevision(value=>value+1);window.addEventListener("profile-changed",sync);return()=>window.removeEventListener("profile-changed",sync);},[]);
  const [isLoading, setIsLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);

  useEffect(() => {
    let active = true;

    let expectedToken = localStorage.getItem('token');
    const refreshed = () => { expectedToken = localStorage.getItem('token'); };
    window.addEventListener('cloudbox:token-refreshed', refreshed);
    const currentSession = () => active && expectedToken === localStorage.getItem('token');
    const loadUser = async () => {
      setIsLoading(true);
      setProfileError(null);

      try {
        const profile = await getMyProfile();
        if (!currentSession()) return;
        localStorage.setItem('user', JSON.stringify(profile));
        beginAccountAppearance(profile.id, expectedToken);
        const preferences = await getPreferences().catch(() => null);
        if (!currentSession()) return;
        if (preferences) applyPreferences(profile.id, preferences, expectedToken);
        const summary =
          preloadDashboard && !profile.permissions?.includes("admin_panel")
            ? await getDashboard().catch(() => null)
            : null;

        if (currentSession()) {
          setUser(profile);
          setDashboardData(summary);
        }
      } catch (error) {
        console.error("Error al obtener usuario:", error);

        if (currentSession()) {
          setUser(null);
          setProfileError(error);
        }
      } finally {
        if (currentSession()) {
          setIsLoading(false);
        }
      }
    };

    loadUser();

    return () => {
      active = false;
      window.removeEventListener('cloudbox:token-refreshed', refreshed);
    };
  }, [preloadDashboard, profileRevision]);

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

function InformationalPage({ component: Page, ...props }) {
  return localStorage.getItem('token')
    ? <AuthenticatedPage><Page {...props} embedded /></AuthenticatedPage>
    : <Page {...props} />;
}
function RecoveryPage() {
  return localStorage.getItem('token') ? <Navigate to="/perfil?tab=seguridad" replace /> : <ForgotPassword />;
}

function App() {
  const [sessionVersion, setSessionVersion] = useState(0);
  useEffect(() => {
    let token = localStorage.getItem('token');
    const synchronize = () => {
      const next = localStorage.getItem('token');
      if (next !== token) { token = next; restoreCachedPreferences(); setSessionVersion(version => version + 1); }
    };
    const storageChanged = event => {
      if (event.key === null || ['token', 'refreshToken', 'user'].includes(event.key)) synchronize();
    };
    const refreshed = () => { token = localStorage.getItem('token'); };
    window.addEventListener('cloudbox:token-refreshed', refreshed);
    window.addEventListener('cloudbox:session-changed', synchronize);
    window.addEventListener('storage', storageChanged);
    return () => { window.removeEventListener('cloudbox:token-refreshed', refreshed); window.removeEventListener('cloudbox:session-changed', synchronize); window.removeEventListener('storage', storageChanged); };
  }, []);
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
      <PageBoundary>
      <Suspense fallback={<Loading text="Cargando página..." />}>
      <OfflineBanner />
      <Routes key={sessionVersion}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/verificar-correo" element={<VerifyEmail />} />
        <Route path="/soporte/mis-solicitudes" element={<AuthenticatedPage>{user => <TicketCenter user={user} />}</AuthenticatedPage>} />
        <Route path="/admin/soporte" element={<AuthenticatedPage requiredPermission="admin_panel">{user => <TicketCenter user={user} />}</AuthenticatedPage>} />
        <Route path="/registro" element={<RegisterPage />} />
        <Route path="/recuperar" element={<RecoveryPage />} />
        <Route path="/sobre-nosotros" element={<InformationalPage component={Product} kind="about" />} />
        <Route path="/nosotros" element={<Navigate to="/sobre-nosotros" replace />} />
        <Route path="/caracteristicas" element={<InformationalPage component={Product} kind="features" />} />
        <Route path="/seguridad" element={<InformationalPage component={Product} kind="security" />} />
        <Route path="/planes" element={<InformationalPage component={Plans} publicCatalog />} />
        <Route path="/soporte" element={<InformationalPage component={Support} />} />
        <Route path="/plan" element={<AuthenticatedPage clientOnly><Plans /></AuthenticatedPage>} />
        <Route path="/pagos" element={<AuthenticatedPage clientOnly><Payments /></AuthenticatedPage>} />
        <Route path="/actividad" element={<AuthenticatedPage clientOnly><Activity /></AuthenticatedPage>} />
        <Route path="/notificaciones" element={<AuthenticatedPage clientOnly><Notifications /></AuthenticatedPage>} />
        <Route path="/admin/notificaciones" element={<AuthenticatedPage requiredPermission="admin_panel">{user => <AdminNotificationInbox user={user} />}</AuthenticatedPage>} />
        <Route path="/admin/planes" element={<AuthenticatedPage requiredPermission="admin_panel"><AdminPlans /></AuthenticatedPage>} />
        <Route path="/admin/suscripciones" element={<AuthenticatedPage requiredPermission="admin_panel"><AdminSubscriptions /></AuthenticatedPage>} />
        <Route path="/admin/almacenamiento" element={<AuthenticatedPage requiredPermission="admin_panel"><AdminStorage /></AuthenticatedPage>} />
        <Route path="/admin/metricas" element={<AuthenticatedPage requiredPermission="admin_panel"><AdminReports /></AuthenticatedPage>} />
        <Route path="/admin/reportes" element={<AuthenticatedPage requiredPermission="admin_panel"><AdminReports /></AuthenticatedPage>} />
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
      </PageBoundary>
    </BrowserRouter>
  );
}

export default App;
