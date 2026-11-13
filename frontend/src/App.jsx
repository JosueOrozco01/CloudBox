import { pageLoaders, installRoutePreload, preloadMainRoutes } from "./routes/pageLoaders";
import { getPreferences } from "./services/settingsService";
import { applyPreferences, beginAccountAppearance, restoreCachedPreferences } from "./utils/preferences";
import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation, useOutletContext } from "react-router-dom";
import PageGuide from "./components/PageGuide/PageGuide";
import PageBoundary from "./components/PageBoundary";
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

// Persistent authenticated shell: loads the session once and keeps AppTopbar mounted
// across route changes. Only the inner content suspends while a page chunk loads.
function AuthenticatedPage({ children }) {
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

  const hasUser = Boolean(user);
  useEffect(() => { if (hasUser) return preloadMainRoutes(); }, [hasUser]);

  if (isLoading) {
    return <Loading delay={300} />;
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

  return (
    <>
      <AppTopbar user={user} />
      <div className="authenticated-content">
        <Suspense fallback={<RouteProgress />}>
          <div className="route-view" key={location.pathname}>
            {children ?? <Outlet context={user} />}
          </div>
        </Suspense>
      </div>
    </>
  );
}

function RouteProgress() {
  return <div className="route-progress" role="progressbar" aria-label="Cargando sección" aria-busy="true"><span /></div>;
}

// Per-route access rules, evaluated inside the persistent shell.
function Protected({ children, requiredPermission = null, clientOnly = false }) {
  const user = useOutletContext();
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  if (clientOnly && permissions.includes("admin_panel")) return <Navigate to="/admin" replace />;
  if (requiredPermission && !permissions.includes(requiredPermission)) return <Navigate to="/dashboard" replace />;
  return typeof children === "function" ? children(user) : children;
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
      <PageBoundary>
      <Suspense fallback={<Loading text="Cargando página..." />}>
      <OfflineBanner />
      <PageGuide />
      <Suspense fallback={<Loading delay={300} />}>
      <Routes key={sessionVersion}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/verificar-correo" element={<VerifyEmail />} />
        <Route path="/registro" element={<RegisterPage />} />
        <Route path="/recuperar" element={<RecoveryPage />} />
        <Route path="/sobre-nosotros" element={<InformationalPage component={Product} kind="about" />} />
        <Route path="/nosotros" element={<Navigate to="/sobre-nosotros" replace />} />
        <Route path="/caracteristicas" element={<InformationalPage component={Product} kind="features" />} />
        <Route path="/seguridad" element={<InformationalPage component={Product} kind="security" />} />
        <Route path="/planes" element={<InformationalPage component={Plans} publicCatalog />} />
        <Route path="/soporte" element={<InformationalPage component={Support} />} />
        <Route element={<AuthenticatedPage />}>
          <Route path="/soporte/mis-solicitudes" element={<Protected>{user =><TicketCenter user={user} />}</Protected>} />
          <Route path="/admin/soporte" element={<Protected requiredPermission="admin_panel">{user =><TicketCenter user={user} />}</Protected>} />
          <Route path="/plan" element={<Protected clientOnly><Plans /></Protected>} />
          <Route path="/pagos" element={<Protected clientOnly><Payments /></Protected>} />
          <Route path="/actividad" element={<Protected clientOnly><Activity /></Protected>} />
          <Route path="/notificaciones" element={<Protected clientOnly><Notifications /></Protected>} />
          <Route path="/admin/notificaciones" element={<Protected requiredPermission="admin_panel">{user =><AdminNotificationInbox user={user} />}</Protected>} />
          <Route path="/admin/planes" element={<Protected requiredPermission="admin_panel"><AdminPlans /></Protected>} />
          <Route path="/admin/suscripciones" element={<Protected requiredPermission="admin_panel"><AdminSubscriptions /></Protected>} />
          <Route path="/admin/almacenamiento" element={<Protected requiredPermission="admin_panel"><AdminStorage /></Protected>} />
          <Route path="/admin/metricas" element={<Protected requiredPermission="admin_panel"><AdminReports /></Protected>} />
          <Route path="/admin/reportes" element={<Protected requiredPermission="admin_panel"><AdminReports /></Protected>} />
          <Route path="/dashboard" element={<Protected clientOnly>{(user) => <Dashboard user={user} />}</Protected>} />
          <Route path="/archivos" element={<Protected clientOnly>{(user) =><FilesPage user={user} />}</Protected>} />
          <Route path="/compartidos" element={<Protected clientOnly>{(user) =><SharedPage user={user} />}</Protected>} />
          <Route path="/papelera" element={<Protected clientOnly>{(user) =><Papelera user={user} />}</Protected>} />
          <Route path="/admin" element={<Protected requiredPermission="admin_panel"><AdminDashboard /></Protected>} />
          <Route path="/admin/usuarios" element={<Protected requiredPermission="manage_users">{(user) =><UserManagement user={user} />}</Protected>} />
          <Route path="/perfil" element={<Protected><UserProfile /></Protected>} />
        </Route>
        <Route path="/terminos" element={<InformationalPage component={Terms} />} />
        <Route path="/privacidad" element={<InformationalPage component={Privacy} />} />
        <Route path="/cookies" element={<InformationalPage component={Cookies} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      </Suspense>
      </PageBoundary>
    </BrowserRouter>
  );
}

export default App;
