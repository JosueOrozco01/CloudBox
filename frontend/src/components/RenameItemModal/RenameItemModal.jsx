import { useEffect } from "react";
import { FolderPen, Pencil } from "lucide-react";
import "../CreateFolderModal/Createfoldermodal.css";

export default function RenameItemModal({
  item,
  name,
  onNameChange,
  busy,
  error,
  onClose,
  onSubmit,
}) {
  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [busy, onClose]);
  const Icon = item.type === "carpeta" ? FolderPen : Pencil;
  return (
    <div
      className="cf-backdrop"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <form
        className="cf-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() && !busy) onSubmit();
        }}
      >
        <div className="cf-header">
          <span className="cf-header-icon">
            <Icon size={18} />
          </span>
          <div className="cf-header-text">
            <h2 id="rename-title">Cambiar nombre</h2>
            <p>
              {item.type === "carpeta"
                ? "Actualiza el nombre de tu carpeta"
                : "Actualiza el nombre de tu archivo"}
            </p>
          </div>
        </div>
        <div className="cf-body">
          <label className="cf-field">
            <span>
              {item.type === "carpeta"
                ? "Nombre de la carpeta"
                : "Nombre del archivo"}
            </span>
            <input
              autoFocus
              value={name}
              required
              disabled={busy}
              maxLength={item.type === "carpeta" ? 80 : 255}
              onChange={(event) => onNameChange(event.target.value)}
              autoComplete="off"
            />
          </label>
          {error && (
            <div className="cf-error" role="alert">
              <p>{error}</p>
            </div>
          )}
        </div>
        <div className="cf-footer">
          <button
            type="button"
            className="cf-cancel-btn"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="cf-create-btn"
            disabled={busy || !name.trim()}
          >
            {busy ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
