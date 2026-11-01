import { normalizeApiUrl } from "../../services/dashboardService";
import Loading from "../../components/Loading/Loading";
import { persistSession } from "../../services/authService";
import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import "./Loginstyle.css";
import Topbar from "../../components/TopbarLogin/Topbar";
import Footer from "../../components/FooterSignOut/Footer";
import AlertModal from "../../components/AlertModal/AlertModal";

export default function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const logoutAlert = location.state?.alert;

  const [alert, setAlert] = useState(() => logoutAlert ? {
    isOpen: true, type: logoutAlert.type || 'success', title: logoutAlert.title || 'Sesión cerrada', message: logoutAlert.message || 'Has cerrado sesión exitosamente.'
  } : { isOpen: false, type: 'info', title: '', message: '' });
  useEffect(() => {
    if (logoutAlert) navigate(location.pathname, { replace: true, state: null });
  }, [logoutAlert, navigate, location.pathname]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validar correo
    if (!email.trim()) {
      setAlert({
        isOpen: true,
        type: "warning",
        title: "Correo requerido",
        message:
          "Ingresa tu correo electrónico para iniciar sesión.",
      });
      return;
    }

    // Validar contraseña
    if (!password) {
      setAlert({
        isOpen: true,
        type: "warning",
        title: "Contraseña requerida",
        message:
          "Ingresa tu contraseña para iniciar sesión.",
      });
      return;
    }

    try {
      // Mostrar Loading
      setLoading(true);



      const response = await fetch(
        `${normalizeApiUrl(import.meta.env.VITE_API_URL)}/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
          }),
        }
      );

      const data = await response.json();

      // Error del backend
      if (!response.ok) {
        setAlert({
          isOpen: true,
          type: "error",
          title: "No se pudo iniciar sesión",
          message:
            data.message ||
            "El correo o la contraseña son incorrectos.",
        });

        return;
      }

      persistSession(data);

      // Indicar que el usuario acaba de iniciar sesión
      localStorage.setItem("justLoggedIn", "true");

      // Ocultar Loading
      setLoading(false);

      // Ir directamente al Dashboard
      navigate("/dashboard");

    } catch (error) {
      console.error("Error al iniciar sesión:", error);

      setAlert({
        isOpen: true,
        type: "error",
        title: "Error de conexión",
        message:
          "No se pudo conectar con el servidor. Verifica que el backend esté ejecutándose.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <Topbar />
      {loading && <Loading text="Iniciando sesión" fullScreen={false} />}

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
            <h2 className="card-title">
              Iniciar sesión
            </h2>

            <p className="card-subtitle">
              Accede a tu espacio de almacenamiento en CloudBox.
            </p>

            {/* Correo */}
            <div className="field">
              <label htmlFor="email">
                Correo electrónico
              </label>

              <span className="field-icon">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect
                    width="20"
                    height="16"
                    x="2"
                    y="4"
                    rx="2"
                  />

                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </span>

              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                placeholder="correo@ejemplo.com"
                autoComplete="email"
                required
              />
            </div>

            {/* Contraseña */}
            <div className="field">
              <label htmlFor="password">
                Contraseña
              </label>

              <span className="field-icon">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect
                    width="18"
                    height="11"
                    x="3"
                    y="11"
                    rx="2"
                  />

                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>

              <input
                id="password"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                placeholder="••••••••••••"
                autoComplete="current-password"
                required
              />

              <button
                type="button"
                className="toggle-eye"
                onClick={() =>
                  setShowPassword((v) => !v)
                }
                aria-label={
                  showPassword
                    ? "Ocultar contraseña"
                    : "Mostrar contraseña"
                }
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />

                  <circle
                    cx="12"
                    cy="12"
                    r="3"
                  />

                  {showPassword && (
                    <path d="m3 3 18 18" />
                  )}
                </svg>
              </button>
            </div>

            {/* Recuperar contraseña */}
            <Link
              className="forgot"
              to="/recuperar"
            >
              ¿Olvidaste tu contraseña?
            </Link>

            {/* Botón */}
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading
                ? "Iniciando sesión..."
                : "Iniciar sesión"}
            </button>

            {/* Registro */}
            <p className="signup">
              ¿No tienes una cuenta?{" "}
              <Link to="/registro">
                Crear cuenta
              </Link>
            </p>
          </form>
        </section>
      </main>

      {/* Footer */}
      <Footer />

      {/* Alertas de error y validación */}
      <Link to="/verificar-correo" className="module-button">Verificar cuenta o reenviar correo</Link>
      <Link to="/verificar-correo" className="module-button">Verificar cuenta o reenviar correo</Link>
      <AlertModal
        isOpen={alert.isOpen}
        onClose={() => {
          setAlert((prev) => ({
            ...prev,
            isOpen: false,
          }));
        }}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        variant={alert.type === "success" ? "toast" : "modal"}
      />
    </div>
  );
}

