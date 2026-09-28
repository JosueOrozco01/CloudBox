import { Link, useLocation } from "react-router-dom";
import "./Topbar.css";

export default function Topbar() {
  const { pathname } = useLocation();
  const isRegisterPage = pathname === "/registro";

  return (
    <header className="topbar">
      <Link className="brand" to="/">
        {/* Coloca tu logo en la carpeta public con este nombre */}
        <img src="/logo-cloudbox.png" alt="CloudBox" />
      </Link>

      <nav className="topbar-actions">
        <button type="button" className="help-btn">
          ¿Necesitas Ayuda?
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {isRegisterPage ? (
          <Link className="btn-small" to="/login">Iniciar sesión</Link>
        ) : (
          <Link className="btn-small" to="/registro">Crear Cuenta</Link>
        )}
      </nav>
    </header>
  );
}