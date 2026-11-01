import { normalizeApiUrl } from "../../services/dashboardService";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import "./Recover.css";

import Topbar from "../../components/TopbarLogin/Topbar";
import Loading from "../../components/Loading/Loading";
import AlertModal from "../../components/AlertModal/AlertModal";

export default function ForgotPassword() {
  const navigate = useNavigate();

  const [step, setStep] = useState("email");

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);

  const [resetCompleted, setResetCompleted] = useState(false);

  const [alert, setAlert] = useState({
    isOpen: false,
    type: "info",
    title: "",
    message: "",
  });

  const closeAlert = () => {
    setAlert((prev) => ({
      ...prev,
      isOpen: false,
    }));
  };

  const handleSendCode = async (e) => {
    e.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setAlert({
        isOpen: true,
        type: "warning",
        title: "Correo requerido",
        message:
          "Ingresa tu correo electrónico para continuar.",
      });

      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `${normalizeApiUrl(import.meta.env.VITE_API_URL)}/auth/forgot-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: normalizedEmail,
          }),
        }
      );

      const data = await response.json();

      console.log("Respuesta recuperación:", data);

      if (!response.ok) {
        setAlert({
          isOpen: true,
          type: "error",
          title: "No se pudo enviar el código",
          message:
            data.message ||
            "No se pudo procesar la solicitud.",
        });

        return;
      }

      setResetCompleted(false);
      setStep("reset");

      setAlert({
        isOpen: true,
        type: "success",
        title: "¡Código enviado!",
        message:
          "Revisa tu correo e ingresa el código recibido para continuar.",
      });
    } catch (error) {
      console.error(
        "Error enviando código de recuperación:",
        error
      );

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

  const handleReset = async (e) => {
    e.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.trim();

    if (!normalizedCode) {
      setAlert({
        isOpen: true,
        type: "warning",
        title: "Código requerido",
        message:
          "Ingresa el código de verificación que recibiste en tu correo.",
      });

      return;
    }

    if (!password) {
      setAlert({
        isOpen: true,
        type: "warning",
        title: "Contraseña requerida",
        message:
          "Ingresa una nueva contraseña.",
      });

      return;
    }

    if (!confirmPassword) {
      setAlert({
        isOpen: true,
        type: "warning",
        title: "Confirmación requerida",
        message:
          "Confirma tu nueva contraseña.",
      });

      return;
    }

    if (password !== confirmPassword) {
      setAlert({
        isOpen: true,
        type: "error",
        title: "Contraseñas incorrectas",
        message:
          "Las contraseñas no coinciden. Verifica que ambas sean iguales.",
      });

      return;
    }

    const passwordRegex =
      /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

    if (!passwordRegex.test(password)) {
      setAlert({
        isOpen: true,
        type: "warning",
        title: "Contraseña no válida",
        message:
          "La contraseña debe tener al menos 8 caracteres, una mayúscula, un número y un símbolo.",
      });

      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `${normalizeApiUrl(import.meta.env.VITE_API_URL)}/auth/reset-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: normalizedEmail,
            token: normalizedCode,
            newPassword: password,
          }),
        }
      );

      const data = await response.json();

      console.log(
        "Respuesta cambio de contraseña:",
        data
      );

      if (!response.ok) {
        setAlert({
          isOpen: true,
          type: "error",
          title:
            "No se pudo restablecer la contraseña",
          message:
            data.message ||
            "No se pudo restablecer la contraseña.",
        });

        return;
      }

      setResetCompleted(true);

      setAlert({
        isOpen: true,
        type: "success",
        title: "¡Contraseña restablecida!",
        message:
          data.message ||
          "Tu contraseña se restableció correctamente.",
      });
    } catch (error) {
      console.error(
        "Error restableciendo contraseña:",
        error
      );

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

  const handleSuccessReset = () => {
    closeAlert();
    navigate("/login");
  };

  const handleAlertClose = () => {
    if (resetCompleted) {
      handleSuccessReset();
      return;
    }

    closeAlert();
  };

  return (
    <div className="forgot-wrapper">
      <Topbar />

      <div className="forgot-page">
        {step === "email" ? (
          <form
            className="forgot-card"
            onSubmit={handleSendCode}
          >
            <div className="forgot-icon">
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
                <rect
                  width="18"
                  height="11"
                  x="3"
                  y="11"
                  rx="2"
                />

                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>

            <h1 className="forgot-title">
              Recupera tu contraseña
            </h1>

            <p className="forgot-subtitle">
              Ingresa el correo asociado a tu cuenta y te
              enviaremos un código para recuperar el acceso.
            </p>

            <div className="field">
              <label htmlFor="email">
                Correo electrónico
              </label>

              <div className="input-wrap">
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
                  placeholder="tu@correo.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading
                ? "Enviando..."
                : "Enviar código"}
            </button>

            <Link
              to="/login"
              className="back-link"
            >
              Volver a iniciar sesión
            </Link>
          </form>
        ) : (
          <form
            className="forgot-card"
            onSubmit={handleReset}
          >
            <div className="forgot-icon">
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
                <rect
                  width="18"
                  height="11"
                  x="3"
                  y="11"
                  rx="2"
                />

                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>

            <h1 className="forgot-title">
              Restablece tu contraseña
            </h1>

            <p className="forgot-subtitle">
              Ingresa el código que enviamos a{" "}
              <strong>{email}</strong> y define tu nueva
              contraseña.
            </p>

            <div className="field">
              <label htmlFor="code">
                Código de verificación
              </label>

              <div className="input-wrap">
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
                    <path d="m9 12 2 2 4-4" />

                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                    />
                  </svg>
                </span>

                <input
                  id="code"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value)
                  }
                  placeholder="Ej. 123456"
                  autoComplete="one-time-code"
                  required
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="password">
                Nueva contraseña
              </label>

              <div className="input-wrap">
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
                  name="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                />

                <button
                  type="button"
                  className="toggle-visibility"
                  onClick={() =>
                    setShowPassword(
                      (value) => !value
                    )
                  }
                  aria-label={
                    showPassword
                      ? "Ocultar contraseña"
                      : "Mostrar contraseña"
                  }
                >
                  {showPassword ? (
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
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />

                      <circle
                        cx="12"
                        cy="12"
                        r="3"
                      />
                    </svg>
                  ) : (
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
                      <path d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.24 4.24M6.5 6.7C3.7 8.4 2 12 2 12s4 7 11 7c1.9 0 3.5-.5 4.9-1.2M9.9 4.2C10.6 4.1 11.3 4 12 4c7 0 11 7 11 7-.5.9-1.7 2.6-3.5 4.1" />
                    </svg>
                  )}
                </button>
              </div>

              <p className="hint">
                Mínimo 8 caracteres. Usa una mayúscula,
                números y símbolos.
              </p>
            </div>

            <div className="field">
              <label htmlFor="confirmPassword">
                Confirmar contraseña
              </label>

              <div className="input-wrap">
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
                  id="confirmPassword"
                  name="confirmPassword"
                  type={
                    showConfirm
                      ? "text"
                      : "password"
                  }
                  value={confirmPassword}
                  onChange={(e) =>
                    setConfirmPassword(
                      e.target.value
                    )
                  }
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                />

                <button
                  type="button"
                  className="toggle-visibility"
                  onClick={() =>
                    setShowConfirm(
                      (value) => !value
                    )
                  }
                  aria-label={
                    showConfirm
                      ? "Ocultar contraseña"
                      : "Mostrar contraseña"
                  }
                >
                  {showConfirm ? (
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
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />

                      <circle
                        cx="12"
                        cy="12"
                        r="3"
                      />
                    </svg>
                  ) : (
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
                      <path d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.24 4.24M6.5 6.7C3.7 8.4 2 12 2 12s4 7 11 7c1.9 0 3.5-.5 4.9-1.2M9.9 4.2C10.6 4.1 11.3 4 12 4c7 0 11 7 11 7-.5.9-1.7 2.6-3.5 4.1" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading
                ? "Restableciendo..."
                : "Restablecer contraseña"}
            </button>

            <button
              type="button"
              className="back-link"
              onClick={() => {
                setCode("");
                setPassword("");
                setConfirmPassword("");
                setResetCompleted(false);
                setStep("email");
              }}
            >
              Solicitar otro código
            </button>

            <Link
              to="/login"
              className="back-link"
            >
              Volver a iniciar sesión
            </Link>
          </form>
        )}
      </div>

      {loading && (
        <Loading
          fullScreen={true}
          text={
            step === "email"
              ? "Enviando código..."
              : "Restableciendo contraseña..."
          }
        />
      )}

      <AlertModal
        isOpen={alert.isOpen}
        onClose={handleAlertClose}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        confirmText="Aceptar"
        variant="modal"
        onConfirm={handleAlertClose}
      />
    </div>
  );
}