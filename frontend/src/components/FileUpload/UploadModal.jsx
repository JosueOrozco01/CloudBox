import { useRef, useState } from "react";
import "./UploadModal.css";

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

function formatBytes(mb) {
  return `${mb} MB`;
}

export default function UploadModal({
  isOpen,
  onClose,
  storage = { usedGB: 18, totalGB: 50 },
  files = [],
  errors = [],
  isUploading = false,
  allowedFormats = "PDF, DOCX, TXT, PNG, JPG y ZIP",
  onFilesSelected,
  onRemoveFile,
  onRetryFile,
  onViewPlans,
  onConfirmUpload,
  onCancel,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  if (!isOpen) return null;

  const availableGB = Math.max(0, storage.totalGB - storage.usedGB).toFixed(2);
  const usedPercent =
    storage.totalGB > 0
      ? Math.min(100, Math.round((storage.usedGB / storage.totalGB) * 100))
      : 0;

  const totalSelectedMB = files.reduce((sum, f) => sum + (f.sizeMB ?? 0), 0);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (isUploading) return;
    if (e.dataTransfer.files?.length) {
      onFilesSelected?.(Array.from(e.dataTransfer.files));
    }
  };

  const handleInputChange = (e) => {
    if (e.target.files?.length) {
      onFilesSelected?.(Array.from(e.target.files));
    }
    e.target.value = "";
  };

  const handleBackdropClick = () => {
    if (!isUploading) onClose?.();
  };

  const errorIcons = {
    invalid_type: (
      <path d="M12 9v4 M12 16h.01 M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    ),
    exceeds_storage: (
      <path d="M12 9v4 M12 16h.01 M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    ),
    upload_failed: (
      <path d="M12 9v4 M12 16h.01 M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    ),
  };

  return (
    <div className="upload-backdrop" onClick={handleBackdropClick}>
      <div
        className="upload-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Subir archivos"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="upload-header">
          <span className="upload-header-icon">
            <svg {...icon}>
              <path d="M12 3v12 M7 8l5-5 5 5 M5 21h14" />
            </svg>
          </span>
          <div className="upload-header-text">
            <h2>Subir archivos</h2>
            <p>Agrega nuevos archivos a tu espacio de almacenamiento</p>
          </div>
          <button
            type="button"
            className="upload-star"
            aria-label="Marcar como favorito"
          >
            <svg {...icon}>
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
        </div>

        <div className="upload-body">
          {/* Zona de arrastrar y soltar */}
          <div
            className={`upload-dropzone ${isDragging ? "dragging" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <span className="upload-dropzone-icon">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 14.9A7 7 0 0 1 7 2a7 7 0 0 1 6.71 5 4.5 4.5 0 0 1 1.3 8.8" />
                <path d="M12 12v9 M9 15l3-3 3 3" />
              </svg>
            </span>
            <p className="upload-dropzone-title">Arrastra tus archivos aquí</p>
            <p className="upload-dropzone-sub">
              o selecciona archivos desde tu dispositivo
            </p>

            <button
              type="button"
              className="upload-select-btn"
              disabled={isUploading}
              onClick={() => inputRef.current?.click()}
            >
              Seleccionar archivos
            </button>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.zip"
              disabled={isUploading}
              hidden
              onChange={handleInputChange}
            />

            <p className="upload-formats">
              Formatos permitidos: <strong>{allowedFormats}</strong>. (Archivos
              .EXE y .BAT no permitidos)
            </p>
          </div>

          {/* Almacenamiento disponible */}
          <div className="upload-storage">
            <div className="upload-storage-head">
              <span>Almacenamiento disponible</span>
              <span>
                {availableGB} GB disponibles de {storage.totalGB} GB
              </span>
            </div>
            <div className="upload-storage-bar">
              <div
                className="upload-storage-fill"
                style={{ width: `${usedPercent}%` }}
              />
            </div>
            <p className="upload-storage-sub">
              {storage.usedGB.toFixed(2)} GB utilizados ({usedPercent}% del
              total)
            </p>
          </div>

          {/* Archivos seleccionados */}
          {files.length > 0 && (
            <div className="upload-selected">
              <div className="upload-selected-head">
                <span>Archivos seleccionados</span>
                <span>
                  {files.length} archivos seleccionados ·{" "}
                  {formatBytes(totalSelectedMB.toFixed(1))}
                </span>
              </div>

              <ul className="upload-file-list">
                {files.map((file) => (
                  <li key={file.id} className="upload-file-item">
                    <span className="upload-file-icon">
                      <svg {...icon} width="16" height="16">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6" />
                      </svg>
                    </span>

                    <div className="upload-file-info">
                      <p className="upload-file-name">{file.name}</p>

                      {file.status === "completed" && (
                        <p className="upload-file-status completed">
                          {formatBytes(file.sizeMB)} · 100%{" "}
                          <svg {...icon} width="13" height="13">
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                          Completado
                        </p>
                      )}

                      {file.status === "uploading" && (
                        <div className="upload-file-progress-row">
                          <div className="upload-file-progress">
                            <div
                              className="upload-file-progress-fill"
                              style={{ width: `${file.progress ?? 0}%` }}
                            />
                          </div>
                          <span className="upload-file-percent">
                            {file.progress ?? 0}%
                          </span>
                        </div>
                      )}

                      {file.status === "uploading" && (
                        <p className="upload-file-status">
                          {formatBytes(file.sizeMB)} ·{" "}
                          {file.progress === 100
                            ? "Procesando..."
                            : "Subiendo..."}
                        </p>
                      )}

                      {file.status === "waiting" && (
                        <p className="upload-file-status">
                          {formatBytes(file.sizeMB)} · En espera
                        </p>
                      )}
                      {file.status === "error" && (
                        <p className="upload-file-status">Error al subir</p>
                      )}
                    </div>

                    <button
                      type="button"
                      className="upload-file-star"
                      aria-label={`Quitar ${file.name}`}
                      disabled={isUploading || file.status === "completed"}
                      onClick={() => onRemoveFile?.(file.id)}
                    >
                      <svg {...icon} width="16" height="16">
                        <path d="m6 6 12 12M18 6 6 18" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Errores */}
          {errors.length > 0 && (
            <div className="upload-errors">
              {errors.map((err) => (
                <div key={err.id} className="upload-error-item">
                  <svg {...icon} width="16" height="16">
                    {errorIcons[err.type] ?? errorIcons.upload_failed}
                  </svg>
                  <p>{err.message}</p>
                  {err.type === "exceeds_storage" && (
                    <button
                      type="button"
                      className="upload-error-action"
                      onClick={onViewPlans}
                    >
                      Ver planes
                    </button>
                  )}
                  {err.type === "upload_failed" && (
                    <button
                      type="button"
                      className="upload-error-action"
                      disabled={isUploading}
                      onClick={() => onRetryFile?.(err.id)}
                    >
                      Reintentar
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="upload-footer">
          <div className="upload-footer-status">
            {isUploading && (
              <>
                <span className="upload-spinner" aria-hidden="true" />
                Subiendo archivos activos...
              </>
            )}
          </div>

          <div className="upload-footer-actions">
            {!isUploading &&
              files.some((file) => file.status === "completed") && (
                <button
                  type="button"
                  className="upload-confirm-btn"
                  onClick={onClose}
                >
                  Listo
                </button>
              )}
            <button
              type="button"
              className="upload-cancel-btn"
              disabled={isUploading}
              onClick={onCancel}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="upload-confirm-btn"
              disabled={
                isUploading ||
                !files.some(
                  (file) =>
                    file.status === "waiting" || file.status === "error",
                ) ||
                storage.totalGB === 0
              }
              onClick={onConfirmUpload}
            >
              Subir archivos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
