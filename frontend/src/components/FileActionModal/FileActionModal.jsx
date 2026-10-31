import Loading from "../Loading/Loading";
import { FolderInput, ShieldAlert, Trash2 } from "lucide-react";
import "../CreateFolderModal/Createfoldermodal.css";
import "./FileActionModal.css";

export default function FileActionModal({
  action,
  busy,
  error,
  destination,
  onDestinationChange,
  locations,
  onClose,
  onSubmit,
  onReorder,
}) {
  const moving = action.kind === "move";
  const permanent = action.kind === 'permanent';
  const Icon = moving ? FolderInput : Trash2;
  return (
    <div
      className="cf-backdrop"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <form
        className={`cf-modal ${permanent ? "file-permanent-dialog" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="file-action-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy) onSubmit();
        }}
      >
        <div className="cf-header">
          <span className={`cf-header-icon ${permanent ? "file-permanent-icon" : ""}`}>
            <Icon size={18} />
          </span>
          <div className="cf-header-text">
            <h2 id="file-action-title">
              {moving ? "Mover elemento" : permanent ? 'Eliminar permanentemente' : "Enviar a papelera"}
            </h2>
            <p>{action.item.name}</p>
          </div>
        </div>
        <div className="cf-body">
          {busy && <Loading inline text="Procesando tu solicitud" />}
          {moving ? (
            <>
              <label className="cf-field">
                <span>Carpeta de destino</span>
                <select
                  value={destination}
                  disabled={busy}
                  onChange={(event) => onDestinationChange(event.target.value)}
                >
                  <option value="">Mis Archivos (raíz)</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="file-action-order">
                <button
                  type="button"
                  className="cf-cancel-btn"
                  disabled={busy}
                  onClick={() => onReorder(-1)}
                >
                  Subir en la lista
                </button>
                <button
                  type="button"
                  className="cf-cancel-btn"
                  disabled={busy}
                  onClick={() => onReorder(1)}
                >
                  Bajar en la lista
                </button>
              </div>
            </>
          ) : permanent ? <div className="file-permanent-warning"><ShieldAlert size={20} /><div><strong>Este cambio es definitivo</strong><p>El archivo se eliminará permanentemente. Esta acción no se puede deshacer.</p></div></div> : (
            <p>
              {permanent ? 'El archivo se eliminará permanentemente. Esta acción no se puede deshacer.' : action.item.type === "carpeta"
                ? "La carpeta y su contenido se enviarán a la papelera."
                : "Puedes restaurar el archivo desde la papelera."}
            </p>
          )}
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
          <button type="submit" className={`cf-create-btn ${permanent ? "file-permanent-submit" : ""}`} disabled={busy}>
            {busy ? "Guardando…" : moving ? "Mover" : permanent ? 'Eliminar permanentemente' : "Enviar a papelera"}
          </button>
        </div>
      </form>
    </div>
  );
}
