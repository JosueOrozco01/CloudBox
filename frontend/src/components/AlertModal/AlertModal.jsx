import { useEffect, useId, useRef } from "react";
import "./AlertModal.css";

const ICONS = {
  success: (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  ),
  error: (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  ),
  warning: (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  ),
  info: (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  ),
};

export default function AlertModal({
  isOpen,
  onClose,
  type = "info",
  title,
  message,
  confirmText = "Aceptar",
  onConfirm,
  cancelText,
  onCancel,
  closeOnBackdropClick = true,
  variant = "modal",
  appearance = "status",
  tone = type,
  autoClose = false,
  autoCloseTime = 3000,
}) {
  const dialogRef = useRef(null);
  const titleId = useId();
  useEffect(() => {
    if (!isOpen || variant === 'toast') return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const dialog = dialogRef.current;
    dialog?.focus();
    const trap = event => {
      if (event.key !== 'Tab') return;
      const nodes = [...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),a[href],[tabindex="0"]')];
      const first = nodes[0], last = nodes.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown',trap);
    return () => { document.removeEventListener('keydown',trap);document.body.style.overflow=overflow;previous?.focus(); };
  }, [isOpen, variant]);
  // Cierra con Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Cierre automático
  useEffect(() => {
    if (!isOpen || !autoClose) return;

    const timer = setTimeout(() => {
      onClose?.();
    }, autoCloseTime);

    return () => clearTimeout(timer);
  }, [isOpen, autoClose, autoCloseTime, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = () => {
    if (closeOnBackdropClick) {
      onClose?.();
    }
  };

  const handleConfirm = () => {
    onConfirm?.();
    onClose?.();
  };

  const handleCancel = () => {
    onCancel?.();
    onClose?.();
  };

  // TOAST
  if (variant === "toast") {
    return (
      <div
        className={`alert-toast alert-toast-${type}${appearance === "brand" ? " alert-toast-brand" : ""}`}
        role="alert"
        aria-live="polite"
      >
        <div className={`alert-toast-icon alert-icon-${tone}`}>
          {ICONS[type]}
        </div>

        <div className="alert-toast-content">
          {title && <h2 className="alert-toast-title">{title}</h2>}

          {message && <p className="alert-toast-message">{message}</p>}
        </div>

        <button
          type="button"
          className="alert-toast-close"
          onClick={onClose}
          aria-label="Cerrar notificación"
        >
          ×
        </button>
      </div>
    );
  }

  // MODAL NORMAL
  return (
    <div className="alert-backdrop" onClick={handleBackdropClick}>
      <div
        className="alert-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : "Notificación"}
        ref={dialogRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`alert-icon alert-icon-${type}`}>{ICONS[type]}</div>

        {title && (
          <h2 id={titleId} className="alert-title">
            {title}
          </h2>
        )}

        {message && <p className="alert-message">{message}</p>}

        <div className="alert-actions">
          {cancelText && (
            <button
              type="button"
              className="alert-btn alert-btn-secondary"
              onClick={handleCancel}
            >
              {cancelText}
            </button>
          )}

          <button
            type="button"
            className={`alert-btn alert-btn-primary alert-btn-${type}`}
            onClick={handleConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
