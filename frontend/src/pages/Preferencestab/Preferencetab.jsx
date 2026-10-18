import { previewTheme } from "../../utils/preferences";
import { useEffect, useState } from "react";
import "./Preferencetab.css";

const defaultNotifications = [
  {
    id: "storage",
    label: "Avisos de almacenamiento",
    description: "Recibe alertas cuando estés cerca de tu límite de almacenamiento",
    enabled: false,
  },
  {
    id: "renewal",
    label: "Renovación del plan",
    description: "Notificaciones sobre cobros próximos y renovaciones de tu suscripción",
    enabled: false,
  },
  {
    id: "shared",
    label: "Archivos compartidos",
    description: "Recibe un aviso cuando alguien comparta carpetas o archivos contigo",
    enabled: false,
  },
  {
    id: "activity",
    label: "Actividad de la cuenta",
    description: "Alertas de inicio de sesión desde nuevos dispositivos o ubicaciones",
    enabled: false,
  },
];

const languages = [
  "Español (América Latina)",
  "Español (España)",
  "English (US)",
  "Português (Brasil)",
];

export default function PreferencesTab({
  initialNotifications = defaultNotifications,
  initialTheme = "claro",
  initialLanguage = languages[0],
  initialShowKB = true,
  isSaving = false,
  onSavePreferences,
  onLogout,
  onDeleteAccount,
}) {
  const [notifications, setNotifications] = useState(() => defaultNotifications.map(item => ({ ...item, enabled: initialNotifications.find(saved => saved.id === item.id)?.enabled === true })));
  const [theme, setTheme] = useState(initialTheme);
  const [language, setLanguage] = useState(initialLanguage);
  const [showKB, setShowKB] = useState(initialShowKB);

  useEffect(() => {
    previewTheme(initialTheme);
    return () => previewTheme(initialTheme);
  }, [initialTheme]);

  const toggleNotification = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, enabled: !n.enabled } : n))
    );
  };

  const handleSave = () => {
    onSavePreferences?.({
      notifications,
      theme,
      language,
      showKB,
    });
  };

  return (
    <div className="pref-tab">
      {/* Notificaciones */}
      <section className="pref-card">
        <h2>Notificaciones</h2>
        <p className="pref-subtitle">Puedes guardar qué avisos deseas recibir. El envío de correos todavía no está habilitado.</p>

        <ul className="pref-toggle-list">
          {notifications.map((item) => (
            <li key={item.id}>
              <div>
                <p className="pref-toggle-label">{item.label}</p>
                <p className="pref-toggle-desc">{item.description}</p>
              </div>
              <button
                type="button"
                className={`pref-switch ${item.enabled ? "on" : ""}`}
                role="switch"
                aria-checked={item.enabled}
                aria-label={item.label}
                disabled={isSaving}
                onClick={() => toggleNotification(item.id)}
              >
                <span className="pref-switch-thumb" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Interfaz y región */}
      <section className="pref-card">
        <h2>Interfaz y región</h2>
        <p className="pref-subtitle">Personaliza la apariencia y el idioma de tu plataforma</p>

        <div className="pref-field">
          <span className="pref-field-label">Tema de la interfaz</span>
          <div className="pref-theme-toggle">
            {[
              { id: "claro", label: "Claro" },
              { id: "oscuro", label: "Oscuro" },
              { id: "sistema", label: "Sistema" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={theme === opt.id ? "active" : ""}
                disabled={isSaving}
                aria-pressed={theme === opt.id}
                onClick={() => { setTheme(opt.id); previewTheme(opt.id); }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <p className="pref-subtitle">El tema se muestra al seleccionarlo. Guarda las preferencias para conservarlo.</p>
        <div className="pref-field">
          <span className="pref-field-label">Idioma predeterminado</span>
          <div className="pref-select-wrap">
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              {languages.map((lang) => (
                <option disabled={lang !== languages[0]} key={lang} value={lang}>
                  {lang}{lang !== languages[0] ? " (próximamente)" : ""}
                </option>
              ))}
            </select>
            <svg
              className="pref-select-chevron"
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
          </div>
        </div>

        <div className="pref-field">
          <span className="pref-field-label">Opciones de visualización</span>
          <label className="pref-checkbox-row">
            <input
              type="checkbox"
              checked={showKB}
              onChange={(e) => setShowKB(e.target.checked)}
            />
            Mostrar tamaño de archivos en kilobytes en lugar de megabytes
          </label>
        </div>

        <div className="pref-save-row">
          <button type="button" className="pref-save-btn" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Guardando..." : "Guardar preferencias"}
          </button>
        </div>
      </section>

      {/* Cuenta */}
      <section className="pref-card">
        <h2>Cuenta</h2>
        <p className="pref-account-text">
          Si cierras sesión tendrás que ingresar tus credenciales nuevamente. Si decides desactivar
          tu cuenta, perderás acceso, pero tus archivos y datos se conservarán.
        </p>

        <div className="pref-account-actions">
          <button type="button" className="pref-secondary-btn" onClick={onLogout}>
            Cerrar sesión
          </button>
          <button type="button" className="pref-danger-btn" onClick={onDeleteAccount}>
            Desactivar cuenta
          </button>
        </div>
      </section>
    </div>
  );
}