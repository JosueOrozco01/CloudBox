import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import "../../components/CreateFolderModal/Createfoldermodal.css";

export default function SharedDialog({ title, subtitle, icon: Icon, busy, onClose, children, footer, onSubmit }) {
  const root = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    root.current?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  const keyboard = event => {
    if (event.key === "Escape" && !busy) onClose();
    if (event.key !== "Tab") return;
    const elements = root.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [href]');
    const first = elements[0], last = elements[elements.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === root.current)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === root.current)) { event.preventDefault(); first?.focus(); }
  };
  return <div className="cf-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
    <form ref={root} tabIndex={-1} className="cf-modal sc-dialog" role="dialog" aria-modal="true" aria-labelledby="shared-dialog-title" onKeyDown={keyboard} onSubmit={e => { e.preventDefault(); if (onSubmit && !busy) onSubmit(e); }}>
      <div className="cf-header"><span className="cf-header-icon"><Icon size={21} /></span><div className="cf-header-text"><h2 id="shared-dialog-title">{title}</h2><p>{subtitle}</p></div><button className="sc-dismiss" type="button" aria-label="Cerrar" disabled={busy} onClick={onClose}><X size={19} /></button></div>
      <div className="cf-body">{children}</div>
      <div className="cf-footer">{footer}</div>
    </form>
  </div>;
}
