import { Link } from "react-router-dom";
import "./LandingPage.css";
import Topbar from "../../components/TopBarPrincipal/Topbarprincipal";
import Footer from "../../components/FooterSignOut/Footer";

function LandingPage() {
  return (
    <div className="landing-page">
      <Topbar />

      <section className="landing-introduction">
        <div className="landing-introduction-content">
            <h1>
            Tus archivos,<br />
            <span>siempre contigo</span>
            </h1>
            <p>
            Almacena, organiza y comparte tus archivos de forma segura
            desde cualquier lugar.
            </p>
            <div className="landing-introduction-actions">
            <Link to="/registro" className="btn-primary">Crear cuenta gratis</Link>
            <button className="btn-ghost">Ver planes</button>
            </div>
        </div>
        </section>
        <section className="features">
        <h2>Todo lo que necesitas para tus archivos</h2>
        <div className="feat-grid">
            <div className="feat-card">
            <span className="feat-icon feat-icon-security" role="img" aria-label="Seguridad" />
            <h3>Almacenamiento seguro</h3>
            <p>Tus archivos cifrados y respaldados, disponibles cuando los necesites.</p>
            </div>
            <div className="feat-card">
            <span className="feat-icon feat-icon-team" role="img" aria-label="Equipo" />
            <h3>Comparte con tu equipo</h3>
            <p>Controla quién ve, edita o descarga cada archivo.</p>
            </div>
            <div className="feat-card">
            <span className="feat-icon feat-icon-anywhere" role="img" aria-label="Acceso desde cualquier lugar" />
            <h3>Acceso desde cualquier lugar</h3>
            <p>Entra desde tu computadora o celular sin perder tu progreso.</p>
            </div>
        </div>
        </section>
        <section className="cta-banner">
            <h3>Empieza a guardar tus archivos hoy</h3>
            <p>Crea tu cuenta gratis, sin tarjeta de crédito.</p>
            <Link to="/registro" className="btn-primary" style={{ background: "var(--surfaceColor)", color: "var(--primaryColor)"}}>Crear cuenta</Link>
        </section>
      <Footer />
    </div>
  );
}

export default LandingPage;