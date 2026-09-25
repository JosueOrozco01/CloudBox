import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Loginstyle.css";
import Topbar from "../../components/Topbar/Topbar";
import Footer from "../../components/FooterSignOut/Footer";

export default function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Error al iniciar sesión");
        return;
      }

      console.log("Login exitoso:", data);

      // Guardar sesión
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("refreshToken", data.refreshToken);

      // Ir al dashboard
      navigate("/dashboard");

    } catch (error) {
      console.error("Error al iniciar sesión:", error);
      alert("No se pudo conectar con el servidor");
    }
  };

  return (
    <div className="login-page">
      <Topbar />

      <main className="split">
        {/* Panel izquierdo */}
        <section className="hero">
          <h1 className="hero-title">
            Tus archivos,
            <span>siempre contigo</span>
          </h1>
          <p className="hero-text">
            Almacena, organiza y comparte tus archivos
            <br />
            de forma segura desde cualquier lugar
          </p>
        </section>

        {/* Panel derecho */}
        <section className="form-side">
          <form className="card" onSubmit={handleSubmit}>
            <h2 className="card-title">Iniciar sesión</h2>
            <p className="card-subtitle">Accede a tu espacio de almacenamiento en CloudBox.</p>

            <div className="field">
              <label htmlFor="email">Correo electrónico</label>
              <span className="field-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </span>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                autoComplete="email"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="password">Contraseña</label>
              <span className="field-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect width="18" height="11" x="3" y="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="toggle-eye"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="3" />
                  {showPassword && <path d="m3 3 18 18" />}
                </svg>
              </button>
            </div>

            <a className="forgot" href="/recuperar">¿Olvidaste tu contraseña?</a>

            <button type="submit" className="btn-primary">Iniciar sesión</button>

            <p className="signup">
              ¿No tienes una cuenta? <Link to="/registro">Crear cuenta</Link>
            </p>
          </form>
        </section>
      </main>
      <Footer />
    </div>
  );
}