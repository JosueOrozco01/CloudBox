export const pageLoaders = {
  VerifyEmail: () => import("../pages/Register/VerifyEmail"),
  TicketCenter: () => import("../pages/Support/TicketCenter"),
  Product: () => import("../pages/Product/Product"),
  SharedPage: () => import("../pages/Compratidoconmigo/ConnectedCompartidos"),
  UserManagement: () => import("../pages/UserManagement/ConnectedUserManagement"),
  LoginPage: () => import("../pages/Login/LoginPage"),
  RegisterPage: () => import("../pages/Register/Register"),
  ForgotPassword: () => import("../pages/RecoverPassword/Recover"),
  Dashboard: () => import("../pages/Dashboard/Dashboard"),
  Papelera: () => import("../pages/Papelera/Papelera"),
  FilesPage: () => import("../pages/Misarchivos/Misarchivos"),
  AdminDashboard: () => import("../pages/AdminDashboard/ConnectedAdminDashboard"),
  LandingPage: () => import("../pages/LandingPage/LandingPage"),
  UserProfile: () => import("../pages/Profile/Profile"),
  Terms: () => import("../pages/Terms/Terms"),
  Privacy: () => import("../pages/Privacy/Privacy"),
  Cookies: () => import("../pages/Cookies/Cookies"),
  Plans: () => import("../pages/Plans/Plans"),
  Payments: () => import("../pages/Payments/Payments"),
  Activity: () => import("../pages/Activity/Activity"),
  Notifications: () => import("../pages/Notifications/Notifications"),
  AdminNotificationInbox: () => import("../pages/Notifications/AdminNotificationInbox"),
  Support: () => import("../pages/Support/Support"),
  AdminPlans: () => import("../pages/AdminPlans/AdminPlans"),
  AdminSubscriptions: () => import("../pages/AdminSubscriptions/AdminSubscriptions"),
  AdminStorage: () => import("../pages/AdminStorage/AdminStorage"),
  AdminReports: () => import("../pages/AdminReports/AdminReports"),
};

const routes = {
  "/": pageLoaders.LandingPage,
  "/login": pageLoaders.LoginPage,
  "/registro": pageLoaders.RegisterPage,
  "/recuperar": pageLoaders.ForgotPassword,
  "/verificar-correo": pageLoaders.VerifyEmail,
  "/dashboard": pageLoaders.Dashboard,
  "/archivos": pageLoaders.FilesPage,
  "/papelera": pageLoaders.Papelera,
  "/compartidos": pageLoaders.SharedPage,
  "/perfil": pageLoaders.UserProfile,
  "/planes": pageLoaders.Plans,
  "/plan": pageLoaders.Plans,
  "/pagos": pageLoaders.Payments,
  "/actividad": pageLoaders.Activity,
  "/notificaciones": pageLoaders.Notifications,
  "/soporte": pageLoaders.Support,
  "/soporte/mis-solicitudes": pageLoaders.TicketCenter,
  "/admin/soporte": pageLoaders.TicketCenter,
  "/admin": pageLoaders.AdminDashboard,
  "/admin/usuarios": pageLoaders.UserManagement,
  "/admin/planes": pageLoaders.AdminPlans,
  "/admin/suscripciones": pageLoaders.AdminSubscriptions,
  "/admin/almacenamiento": pageLoaders.AdminStorage,
  "/admin/metricas": pageLoaders.AdminReports,
  "/admin/reportes": pageLoaders.AdminReports,
  "/admin/notificaciones": pageLoaders.AdminNotificationInbox,
  "/sobre-nosotros": pageLoaders.Product,
  "/caracteristicas": pageLoaders.Product,
  "/seguridad": pageLoaders.Product,
  "/terminos": pageLoaders.Terms,
  "/privacidad": pageLoaders.Privacy,
  "/cookies": pageLoaders.Cookies,
};

export function installRoutePreload() {
  const preload = event => {
    if (navigator.connection?.saveData || /(^|-)2g$/.test(navigator.connection?.effectiveType || '')) return;
    const link = event.target.closest?.('a[href]');
    if (!link) return;
    const url = new URL(link.href, location.href);
    if (url.origin === location.origin && routes[url.pathname]) void routes[url.pathname]().catch(() => {});
  };
  document.addEventListener('pointerover', preload);
  document.addEventListener('focusin', preload);
  return () => {
    document.removeEventListener('pointerover', preload);
    document.removeEventListener('focusin', preload);
  };
}
