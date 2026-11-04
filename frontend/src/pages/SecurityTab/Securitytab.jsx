import { isValidPassword } from '../../utils/passwordPolicy.js';
import { KeyRound, LogOut, Monitor, ShieldCheck, Smartphone } from "lucide-react";
import { useMemo, useState } from "react";
import "./Securitytab.css";

const icon = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

function EyeIcon({ crossed }) {
  return (
    <svg {...icon}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {crossed && <path d="m3 3 18 18" />}
    </svg>
  );
}

const requirementsList = [
  { id: "length", label: "Entre 8 y 128 caracteres", test: (pw) => pw.length >= 8 && pw.length <= 128 },
  { id: "uppercase", label: "Al menos una letra mayúscula", test: (pw) => /[A-Z]/.test(pw) },
  { id: "lowercase", label: "Al menos una letra minúscula", test: (pw) => /[a-z]/.test(pw) },
  { id: "number", label: "Al menos un número", test: (pw) => /[0-9]/.test(pw) },
  { id: "special", label: "Al menos un carácter especial (!@#$%)", test: (pw) => /[^a-zA-Z0-9\s]/.test(pw) },
];

export default function SecurityTab({
  sessions = [],
  isUpdatingPassword = false,
  passwordError,
  onUpdatePassword,
  onLogoutOtherSessions,
  onLogout,
  onDeleteAccount,
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const requirementsStatus = useMemo(
    () => requirementsList.map((req) => ({ ...req, met: req.test(newPassword) })),
    [newPassword]
  );

  const allRequirementsMet = requirementsStatus.every((r) => r.met);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit =
    currentPassword.length > 0 && isValidPassword(newPassword) && allRequirementsMet && passwordsMatch && !isUpdatingPassword;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    Promise.resolve(onUpdatePassword?.({ currentPassword, newPassword })).then(success => {
      if (success) { setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); }
    });
  };

  return (
    <div className="sec-tab">
      {/* Cambiar contraseña */}
      <section className="sec-card">
        <h2><KeyRound size={20} />Cambiar contraseña</h2>
        <p className="sec-subtitle">Elige una contraseña que solo tú conozcas.</p>

        <form onSubmit={handleSubmit} className="sec-form">
          <label className="sec-field">
            <span>Contraseña actual</span>
            <div className="sec-input-wrap">
              <input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                disabled={isUpdatingPassword}
              />
              <button
                type="button"
                className="sec-toggle-eye"
                onClick={() => setShowCurrent((v) => !v)}
                aria-label={showCurrent ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                <EyeIcon crossed={showCurrent} />
              </button>
            </div>
          </label>

          <label className="sec-field">
            <span>Nueva contraseña</span>
            <div className="sec-input-wrap">
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                disabled={isUpdatingPassword}
              />
              <button
                type="button"
                className="sec-toggle-eye"
                onClick={() => setShowNew((v) => !v)}
                aria-label={showNew ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                <EyeIcon crossed={showNew} />
              </button>
            </div>
          </label>

          <label className="sec-field">
            <span>Confirmar nueva contraseña</span>
            <div className="sec-input-wrap">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                disabled={isUpdatingPassword}
              />
              <button
                type="button"
                className="sec-toggle-eye"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                <EyeIcon crossed={showConfirm} />
              </button>
            </div>
            {confirmPassword.length > 0 && !passwordsMatch && (
              <span className="sec-field-error">Las contraseñas no coinciden</span>
            )}
          </label>

          <div className="account-password-progress"><span><ShieldCheck size={14} />Requisitos cumplidos</span><strong>{requirementsStatus.filter(req => req.met).length} de {requirementsStatus.length}</strong><div role="progressbar" aria-label="Requisitos de la contraseña cumplidos" aria-valuemin={0} aria-valuemax={requirementsStatus.length} aria-valuenow={requirementsStatus.filter(req => req.met).length}>{requirementsStatus.map(req => <span key={req.id} className={req.met ? 'met' : ''} />)}</div></div>
          <div className="sec-requirements">
            <p>Requisitos para la nueva contraseña:</p>
            <ul>
              {requirementsStatus.map((req) => (
                <li key={req.id} className={req.met ? "met" : ""}>
                  <svg {...icon} width="14" height="14">
                    {req.met ? <path d="M20 6 9 17l-5-5" /> : <circle cx="12" cy="12" r="9" />}
                  </svg>
                  {req.label}
                </li>
              ))}
            </ul>
          </div>

          {passwordError && <p className="sec-error-banner">{passwordError}</p>}

          <div className="sec-form-actions">
            <button type="submit" className="sec-primary-btn" disabled={!canSubmit}>
              {isUpdatingPassword ? "Actualizando..." : "Actualizar contraseña"}
            </button>
          </div>
        </form>
      </section>

      {/* Sesiones activas */}
      <section className="sec-card">
        <h2><Monitor size={20} />Sesiones registradas<span className="account-session-count">{sessions.length}</span></h2><p className="sec-subtitle">Revisa los dispositivos y los accesos registrados por CloudBox.</p><details className="account-session-about"><summary>Acerca de este historial</summary><p>Las ubicaciones son aproximadas y no se pueden determinar para IP locales o privadas. Los cierres externos a CloudBox pueden tardar en reflejarse.</p></details>
        {!sessions.length && <div className="account-sessions-empty"><Monitor size={28} /><p>No hay accesos registrados en esta consulta.</p></div>}
        <ul className="sec-session-list">
          {sessions.map((session) => (
            <li key={session.id} className="sec-session-item">
              <span className="sec-session-icon">
                {/android|iphone|móvil|mobile/i.test(session.device || '') ? <Smartphone size={21} /> : <Monitor size={21} />}
              </span>
              <div className="sec-session-info">
                <p className="sec-session-device">
                  {session.device}
                  {session.isCurrent && <span className="sec-session-tag">Sesión actual</span>}
                </p>
                <p className="sec-session-meta">
                  IP: {session.ip} · {session.location || "Ubicación no disponible"}<br />
                  Inicio: {session.startedAt ? new Date(session.startedAt).toLocaleString("es-GT") : "Fecha no disponible"}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <button type="button" className="sec-secondary-btn" disabled={isUpdatingPassword} onClick={onLogoutOtherSessions}>
          Cerrar otras sesiones
        </button>
      </section>

      {/* Cuenta */}
      <section className="sec-card">
        <h2><LogOut size={20} />Tu cuenta</h2>
        <p className="sec-account-text">
          Si cierras sesión tendrás que ingresar tus credenciales nuevamente. Si decides desactivar
          tu cuenta, perderás acceso, pero tus archivos y datos se conservarán.
        </p>

        <div className="sec-account-actions">
          <button type="button" className="sec-secondary-btn" disabled={isUpdatingPassword} onClick={onLogout}>
            Cerrar sesión
          </button>
          <button type="button" className="sec-danger-btn" disabled={isUpdatingPassword} onClick={onDeleteAccount}>
            Desactivar cuenta
          </button>
        </div>
      </section>
    </div>
  );
}