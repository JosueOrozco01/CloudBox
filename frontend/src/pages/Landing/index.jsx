import "./LandingPageStyles.css";
import Topbar from "../../components/Topbar/Topbar.jsx";
import { Globe2, ShieldCheck, Users } from "lucide-react";

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
            <button className="btn-primary">Crear cuenta gratis</button>
            <button className="btn-ghost">Ver planes</button>
            </div>
        </div>
        </section>
        <section className="features">
        <h2>Todo lo que necesitas para tus archivos</h2>
        <div className="feat-grid">
            <div className="feat-card">
            <ShieldCheck className="feat-icon" aria-hidden="true" />
            <h3>Almacenamiento seguro</h3>
            <p>Tus archivos cifrados y respaldados, disponibles cuando los necesites.</p>
            </div>
            <div className="feat-card">
            <Users className="feat-icon" aria-hidden="true" />
            <h3>Comparte con tu equipo</h3>
            <p>Controla quién ve, edita o descarga cada archivo.</p>
            </div>
            <div className="feat-card">
            <Globe2 className="feat-icon" aria-hidden="true" />
            <h3>Acceso desde cualquier lugar</h3>
            <p>Entra desde tu computadora o celular sin perder tu progreso.</p>
            </div>
        </div>
        </section>
        <section className="cta-banner">
            <h3>Empieza a guardar tus archivos hoy</h3>
            <p>Crea tu cuenta gratis, sin tarjeta de crédito.</p>
            <button className="btn-primary" style={{ background: "var(--surfaceColor)", color: "var(--primaryColor)" }}>
                Crear cuenta
            </button>
        </section>

    </div>
  );
}

export default LandingPage;