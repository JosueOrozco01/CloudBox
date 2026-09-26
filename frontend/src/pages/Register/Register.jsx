import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Register.css";
import Topbar from "../../components/Topbar/Topbar";
import Loading from "../../components/Loading/Loading";

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    nombre: "",
    apellidos: "",
    email: "",
    password: "",
    confirmPassword: "",
    aceptaTerminos: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      alert("Las contraseñas no coinciden");
      return;
    }

    if (!form.aceptaTerminos) {
      alert("Debes aceptar los términos y condiciones");
      return;
    }

    try {
      const response = await fetch(
        "http://localhost:3000/api/auth/register",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            firstName: form.nombre,
            lastName: form.apellidos,
            email: form.email,
            password: form.password,
          }),
        }
      );

      const data = await response.json();

      console.log("Respuesta del registro:", data);

      if (!response.ok) {
        alert(data.message || "No se pudo crear la cuenta");
        return;
      }

      setLoading(true);

      await new Promise((resolve) => setTimeout(resolve, 1000));

      alert(
        data.message ||
          "Cuenta creada correctamente. Revisa tu correo para verificarla."
      );

      navigate("/login");

    } catch (error) {
      console.error("Error al registrar usuario:", error);
      alert("No se pudo conectar con el servidor");

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-wrapper">
      <Topbar />

      <div className="signup-page">
        <form className="signup-card" onSubmit={handleSubmit}>
          <div className="signup-icon">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
            </svg>
          </div>

          <h1 className="signup-title">Crea tu cuenta</h1>

          <p className="signup-subtitle">
            Comienza a gestionar tu almacenamiento en CloudBox
          </p>

          <div className="field">
            <label htmlFor="nombre">Nombre</label>

            <input
              id="nombre"
              name="nombre"
              type="text"
              value={form.nombre}
              onChange={handleChange}
              placeholder="Ej. XXXX"
              autoComplete="given-name"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="apellidos">Apellido</label>

            <input
              id="apellidos"
              name="apellidos"
              type="text"
              value={form.apellidos}
              onChange={handleChange}
              placeholder="Ej. XXXX"
              autoComplete="family-name"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="email">Correo electrónico</label>

            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="XXXXXXX@correo.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">Contraseña</label>

            <div className="input-wrap">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••••"
                autoComplete="new-password"
                required
              />

              <button
                type="button"
                className="toggle-eye"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={
                  showPassword
                    ? "Ocultar contraseña"
                    : "Mostrar contraseña"
                }
              >
                <EyeIcon crossed={showPassword} />
              </button>
            </div>

            <p className="hint">
              Mínimo 8 caracteres. Usa letras, números y símbolos.
            </p>
          </div>

          <div className="field">
            <label htmlFor="confirmPassword">
              Confirmar contraseña
            </label>

            <div className="input-wrap">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••••"
                autoComplete="new-password"
                required
              />

              <button
                type="button"
                className="toggle-eye"
                onClick={() =>
                  setShowConfirmPassword((v) => !v)
                }
                aria-label={
                  showConfirmPassword
                    ? "Ocultar contraseña"
                    : "Mostrar contraseña"
                }
              >
                <EyeIcon crossed={showConfirmPassword} />
              </button>
            </div>
          </div>

          <label className="checkbox-row">
            <input
              type="checkbox"
              name="aceptaTerminos"
              checked={form.aceptaTerminos}
              onChange={handleChange}
              required
            />

            <span>
              Acepto los{" "}
              <Link to="/terminos">
                términos y condiciones
              </Link>{" "}
              de uso
            </span>
          </label>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </button>

          <p className="login-link">
            ¿Ya tienes una cuenta?{" "}
            <Link to="/login">Iniciar sesión</Link>
          </p>
        </form>
      </div>
      {loading && (
        <Loading
          fullScreen={false}
          text="Creando cuenta..."
        />
      )}
    </div>
  );
}

function EyeIcon({ crossed }) {
  return (
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
      <circle cx="12" cy="12" r="3" />
      {crossed && <path d="m3 3 18 18" />}
    </svg>
  );
}