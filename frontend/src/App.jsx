import { pageLoaders, installRoutePreload } from "./routes/pageLoaders";
import { getPreferences } from "./services/settingsService";
import { applyPreferences, beginAccountAppearance, restoreCachedPreferences } from "./utils/preferences";
import { lazy, Suspense, useEffect, useState } from "react";
import PageGuide from "./components/PageGuide/PageGuide";
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
import { getMyProfile, getCachedProfile } from "./services/profileService";

const VerifyEmail = lazy(pageLoaders.VerifyEmail);
const TicketCenter = lazy(pageLoaders.TicketCenter);
const Product = lazy(pageLoaders.Product);
const SharedPage = lazy(pageLoaders.SharedPage);
const UserManagement = lazy(pageLoaders.UserManagement);
const LoginPage = lazy(pageLoaders.LoginPage);
const RegisterPage = lazy(pageLoaders.RegisterPage);
const ForgotPassword = lazy(pageLoaders.ForgotPassword);
const Dashboard = lazy(pageLoaders.Dashboard);
const Papelera = lazy(pageLoaders.Papelera);
const FilesPage = lazy(pageLoaders.FilesPage);
const AdminDashboard = lazy(pageLoaders.AdminDashboard);
const LandingPage = lazy(pageLoaders.LandingPage);
const UserProfile = lazy(pageLoaders.UserProfile);
const Terms = lazy(pageLoaders.Terms);
const Privacy = lazy(pageLoaders.Privacy);
const Cookies = lazy(pageLoaders.Cookies);
const Plans = lazy(pageLoaders.Plans);
const Payments = lazy(pageLoaders.Payments);
const Activity = lazy(pageLoaders.Activity);
const Notifications = lazy(pageLoaders.Notifications);
const AdminNotificationInbox = lazy(pageLoaders.AdminNotificationInbox);
const Support = lazy(pageLoaders.Support);
const AdminPlans = lazy(pageLoaders.AdminPlans);
const AdminSubscriptions = lazy(pageLoaders.AdminSubscriptions);
const AdminStorage = lazy(pageLoaders.AdminStorage);
const AdminReports = lazy(pageLoaders.AdminReports);

function AuthenticatedPage({
  children,
  requiredPermission = null,
  clientOnly = false,
}) {
  const location = useLocation();

  const [user, setUser] = useState(getCachedProfile);
  const [profileRevision,setProfileRevision]=useState(0);
  useEffect(()=>{const sync=()=>setProfileRevision(value=>value+1);window.addEventListener("profile-changed",sync);return()=>window.removeEventListener("profile-changed",sync);},[]);
  const [isLoading, setIsLoading] = useState(() => !getCachedProfile());
  const [profileError, setProfileError] = useState(null);

  useEffect(() => {
    let active = true;

    let expectedToken = localStorage.getItem('token');
    const refreshed = () => { expectedToken = localStorage.getItem('token'); };
    window.addEventListener('cloudbox:token-refreshed', refreshed);
    const currentSession = () => active && expectedToken === localStorage.getItem('token');
    const loadUser = async () => {
      setIsLoading(!getCachedProfile());
      setProfileError(null);

      try {
        const preferenceRequest = getPreferences().catch(() => null);
        const profile = await getMyProfile({ force: profileRevision > 0 });
        if (!currentSession()) return;
        localStorage.setItem('user', JSON.stringify(profile));
        beginAccountAppearance(profile.id, expectedToken);
        setUser(profile);
        // Preferences do not delay the page's own data requests.
        preferenceRequest.then(preferences => {
          if (currentSession() && preferences) applyPreferences(profile.id, preferences, expectedToken);
        });
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
  }, [profileRevision]);

  if (isLoading) {
    return <Loading />;
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
      <div className="authenticated-content">{typeof children === "function"
        ? children(user)
        : children}</div>
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
  useEffect(installRoutePreload, []);
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
      <OfflineBanner />
      <PageGuide />
      <Suspense fallback={<Loading />}>
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
            <AuthenticatedPage key="dashboard" clientOnly>
              {(user) => (
                <Dashboard user={user} />
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
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
