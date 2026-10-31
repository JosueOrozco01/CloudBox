import { RefreshCw as LoadingArrows } from "lucide-react";
import "../Loading/Loading.css";
import { useEffect, useRef, useState } from "react";
import "./Createfoldermodal.css";

const icon = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export default function CreateFolderModal({
  isOpen,
  onClose,
  onCreate,
  isCreating = false,
  errorMessage,
  locations = [],
  defaultLocationId,
}) {
  const [name, setName] = useState("");
  const [locationId, setLocationId] = useState(defaultLocationId ?? "");
  const inputRef = useRef(null);

  // Limpia el formulario y enfoca el campo cada vez que se abre
  useEffect(() => {
    if (isOpen) {
      const timeout = setTimeout(() => {
        setName("");
        setLocationId(defaultLocationId ?? "");
        inputRef.current?.focus();
      }, 0);
      return () => clearTimeout(timeout);
    }
  }, [isOpen, defaultLocationId]);

  // Cierra con la tecla Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !isCreating) onClose?.();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, isCreating]);

  if (!isOpen) return null;

  const trimmedName = name.trim();
  const isValid = trimmedName.length > 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isValid || isCreating) return;
    onCreate?.({ name: trimmedName, locationId: locationId || null });
  };

  const handleBackdropClick = () => {
    if (!isCreating) onClose?.();
  };

  return (
    <div className="cf-backdrop" onClick={handleBackdropClick}>
      <form
        className="cf-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Crear carpeta"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="cf-header">
          <span className="cf-header-icon">
            <svg {...icon}>
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <path d="M12 11v4 M10 13h4" />
            </svg>
          </span>
          <div className="cf-header-text">
            <h2>Crear carpeta</h2>
            <p>Organiza tus archivos creando una nueva carpeta</p>
          </div>
        </div>

        <div className="cf-body">
          <label className="cf-field">
            <span>Nombre de la carpeta</span>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Proyectos 2026"
              maxLength={80}
              disabled={isCreating}
              autoComplete="off"
            />
          </label>

          {locations.length > 0 && (
            <label className="cf-field">
              <span>Ubicación</span>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                disabled={isCreating}
              >
                <option value="">Mis Archivos (raíz)</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {errorMessage && (
            <div className="cf-error">
              <svg {...icon} width="16" height="16">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4 M12 16h.01" />
              </svg>
              <p>{errorMessage}</p>
            </div>
          )}
        </div>

        <div className="cf-footer">
          <button
            type="button"
            className="cf-cancel-btn"
            onClick={onClose}
            disabled={isCreating}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="cf-create-btn"
            disabled={!isValid || isCreating}
          >
            {isCreating ? (
              <>
                <LoadingArrows size={16} className="loading-arrows" aria-hidden="true" />
                Creando...
              </>
            ) : (
              "Crear carpeta"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
