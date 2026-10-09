import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { logout } from "../../services/authService";
import Loading from "../Loading/Loading";
import AlertModal from "../AlertModal/AlertModal";
import "./Apptopbar.css";

// Links base, visibles para cualquier usuario autenticado
const clientLinks = [
  { label: "Inicio", to: "/dashboard" },
  { label: "Mis Archivos", to: "/archivos" },
  { label: "Compartidos", to: "/compartidos" },
  { label: "Mi Plan", to: "/plan" },
  { label: "Pagos", to: "/pagos" },
  { label: "Soporte", to: "/soporte" },
];

const adminLinks = [
  { label: "Dashboard", to: "/admin" },
  { label: "Usuarios", to: "/admin/usuarios" },
  { label: "Planes", to: "/admin/planes" },
  { label: "Suscripciones", to: "/admin/suscripciones" },
  { label: "Almacenamiento", to: "/admin/almacenamiento" },
  { label: "Métricas", to: "/admin/metricas" },
];

export default function AppTopbar({ user }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [searchUsers, setSearchUsers] = useState("");

  const [alert, setAlert] = useState({
    open: false,
    type: "error",
    message: "",
    });

  const fullName = [user?.nombre, user?.apellido].filter(Boolean).join(" ");

  const initials =
    `${user?.nombre?.charAt(0) || ""}${user?.apellido?.charAt(0) || ""}`.toUpperCase() || "?";

  // `user.permissions` viene del backend (por ejemplo, al llamar a "obtener usuario autenticado").
  // Mientras no tengas esa conexión lista, user puede llegar como undefined y no se rompe nada.
  const permissions = Array.isArray(user?.permissions)
    ? user.permissions
    : [];

  const isAdmin = permissions.includes("admin_panel");

  const visibleLinks = isAdmin ? adminLinks : clientLinks;

  // Cierra el menú de usuario si haces clic fuera de él
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cierra el menú móvil si la pantalla vuelve a ser grande
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 900) setMobileOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    setMenuOpen(false);

    try {
        await logout();

        navigate("/login", {
        replace: true,
        state: {
            alert: {
            type: "success",
            title: "Sesión cerrada",
            message: "Sesión cerrada exitosamente.",
            },
        },
        });
    } catch (error) {
        console.error("Error al cerrar sesión:", error);

        setAlert({
        open: true,
        type: "error",
        message: "No se pudo cerrar sesión. Inténtalo nuevamente.",
        });
    } finally {
        setIsLoggingOut(false);
    }
  };

  const handleSearchUsers = (e) => {
    e.preventDefault();

    const search = searchUsers.trim();

    if (!search) return;

    navigate(
      `/admin/usuarios?search=${encodeURIComponent(search)}`
    );

    setMobileOpen(false);
  };

  return (
    <>
        {isLoggingOut && <Loading />}

        <AlertModal
          isOpen={alert.open}
          type={alert.type}
          title="Error al cerrar sesión"
          message={alert.message}
          variant="modal"
          onClose={() =>
            setAlert((prev) => ({
              ...prev,
              open: false,
            }))
          }
        />

    <header className={`app-topbar ${isAdmin ? "app-topbar-admin" : ""}`}>
      <div className="app-topbar-left">
        <button
          type="button"
          className="app-menu-toggle"
          onClick={() => setMobileOpen((open) => !open)}
          aria-expanded={mobileOpen}
          aria-label="Abrir menú"
        >
          <span />
          <span />
          
        </button>

        <Link className="app-brand" to={isAdmin ? "/admin" : "/dashboard"}>
          {/* Coloca tu logo en la carpeta public con este nombre */}
          <img src="/logo-cloudbox.png" alt="CloudBox" />
        </Link>
      </div>

      <nav className="app-topbar-links">
        {visibleLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

        {isAdmin && (
          <form
            className="app-admin-search"
            onSubmit={handleSearchUsers}
            role="search"
          >
            <input
              type="search"
              placeholder="Buscar usuarios..."
              aria-label="Buscar usuarios"
              value={searchUsers}
              onChange={(e) => setSearchUsers(e.target.value)}
            />

            <button
              type="submit"
              aria-label="Buscar"
              disabled={!searchUsers.trim()}
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </button>
          </form>
        )}

      {isAdmin && (
        <button
          type="button"
          className="app-notification-button"
          aria-label="Notificaciones"
          title="Notificaciones"
          disabled
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
            <path d="M10 21h4" />
          </svg>
        </button>
      )}

      <div className="app-user-menu" ref={menuRef}>
        <button
          type="button"
          className="app-user-trigger"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
        >
          <span className="app-user-avatar">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={fullName || "Usuario"} />
            ) : (
              initials
            )}
          </span>
          <div className="app-user-info">
            <span className="app-user-name">
              {fullName || "Mi cuenta"}
            </span>

            {isAdmin && (
              <span className="app-user-role">
                {user?.rol || "Administrador"}
              </span>
            )}
          </div>
          <svg
            className={`app-user-chevron ${menuOpen ? "open" : ""}`}
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {menuOpen && (
          <div className="app-user-dropdown">
            <Link to="/perfil" className="app-user-dropdown-item" onClick={() => setMenuOpen(false)}>
              Mi perfil
            </Link>
            <button
              type="button"
              className="app-user-dropdown-item danger"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
            </button>
          </div>
        )}
      </div>

      {/* Menú desplegable para pantallas angostas */}
      {mobileOpen && (
        <nav className="app-mobile-menu">
          {visibleLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => (isActive ? "active" : "")}
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
    </>
  );
}