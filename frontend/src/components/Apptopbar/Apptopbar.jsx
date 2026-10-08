import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { logout } from "../../services/authService";
import Loading from "../Loading/Loading";
import AlertModal from "../AlertModal/AlertModal";
import "./Apptopbar.css";

// Links base, visibles para cualquier usuario autenticado
const baseLinks = [
  { label: "Inicio", to: "/dashboard" },
  { label: "Mis Archivos", to: "/archivos" },
  { label: "Compartidos", to: "/compartidos" },
  { label: "Mi Plan", to: "/plan" },
  { label: "Pagos", to: "/pagos" },
  { label: "Soporte", to: "/soporte" },
];

// Links que solo deben verse si el backend le dio el permiso correspondiente al usuario
const permissionLinks = [
  { label: "Panel Administrativo", to: "/admin", permission: "admin_panel" },
  { label: "Gestión de Usuarios", to: "/admin/usuarios", permission: "manage_users" },
];

export default function AppTopbar({ user }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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
  const permissions = user?.permissions ?? [];

  const visibleLinks = [
    ...baseLinks,
    ...permissionLinks.filter((link) => permissions.includes(link.permission)),
  ];

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

  return (
    <>
        {isLoggingOut && <Loading />}

        <AlertModal
        isOpen={alert.open}
        type={alert.type}
        message={alert.message}
        onClose={() =>
            setAlert((prev) => ({
            ...prev,
            open: false,
            }))
        }
        />

    <header className="app-topbar">
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
          <span />
        </button>

        <Link className="app-brand" to="/dashboard">
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
          <span className="app-user-name">{fullName || "Mi cuenta"}</span>
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