import { Link } from "react-router-dom";
import "./Topbarprincipal.css";

function LandingNavbar() {
  return (
    <header className="landing-nav">
      <div className="landing-nav-inner">
        <Link className="landing-logo" to="/">
          <img src="/logo-cloudbox.png" alt="CloudBox" />
        </Link>

        <nav className="landing-nav-links">
          <Link to="/caracteristicas">Características</Link>
          <Link to="/planes">Planes</Link>
          <Link to="/seguridad">Seguridad</Link>
          <Link to="/sobre-nosotros">Sobre nosotros</Link>
          <Link to="/soporte">Soporte</Link>
        </nav>

        <div className="landing-nav-cta">
          <Link to="/login" className="landing-login-link">Iniciar sesión</Link>
          <Link to="/registro" className="btn-primary">Crear cuenta</Link>
        </div>
      </div>
    </header>
  );
}

export default LandingNavbar;