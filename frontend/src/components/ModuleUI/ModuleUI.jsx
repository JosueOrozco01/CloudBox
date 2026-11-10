import Loading from "../Loading/Loading";
import { useEffect, useEffectEvent, useRef } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Inbox, X, FileText } from 'lucide-react';
import Footer from '../FooterSignOut/Footer';
import '../CreateFolderModal/Createfoldermodal.css';
import './ModuleUI.css';
export function ModulePage({
  title,
  description,
  actions,
  loading = false,
  children
}) {
  return <><div className="module-shell"><main className="module-page" aria-busy={loading}><header className="module-heading"><div><h1>{title}</h1><p>{description}</p></div><div className="module-actions">{actions}</div></header>{loading ? <Loading /> : children}</main></div><Footer /></>;
}
export function Panel({
  title,
  children,
  actions
}) {
  return <section className="module-panel">{title && <header className="module-panel-heading"><h2>{title}</h2>{actions}</header>}{children}</section>;
}
export function Feedback({
  error,
  message
}) {
  return error ? <div className="module-feedback error" role="alert">{error}</div> : message ? <div className="module-feedback" role="status">{message}</div> : null;
}
export function Empty({
  children = 'No hay registros para mostrar.'
}) {
  return <div className="module-empty"><Inbox size={30} /><p>{children}</p></div>;
}
export function Refresh({
  onClick,
  busy
}) {
  return <button className="module-button" onClick={onClick} disabled={busy}><RefreshCw size={16} />Actualizar</button>;
}
export function Stats({
  items
}) {
  return <div className="module-stats">{items.map(([label, value, hint]) => <div className="module-stat" key={label}><span>{label}</span><strong>{value ?? '—'}</strong>{hint && <small>{hint}</small>}</div>)}</div>;
}
export function Badge({
  children
}) {
  const tone = ['Activo', 'Activa', 'Aprobado'].includes(children) ? 'success' : ['Pendiente', 'PorVencer'].includes(children) ? 'warning' : ['Inactivo', 'Vencida', 'Cancelada', 'Rechazado'].includes(children) ? 'danger' : '';
  return <span className={`module-badge ${tone}`}>{children || '—'}</span>;
}
export function Table({
  columns,
  rows,
  rowKey = 'id'
}) {
  if (!rows?.length) return <Empty />;
  return <div className="module-table-scroll"><table className="module-table"><thead><tr>{columns.map(c => <th key={c.label} scope="col">{c.label}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={row[rowKey] ?? i}>{columns.map(c => <td key={c.label}>{c.render ? c.render(row) : row[c.key] ?? '—'}</td>)}</tr>)}</tbody></table></div>;
}
export function Pager({
  page,
  onChange,
  hasNext,
  busy
}) {
  return <nav className="module-pager" aria-label="Paginación"><button className="module-button" disabled={page <= 1 || busy} onClick={() => onChange(page - 1)}>Anterior</button><span>Página {page}</span><button className="module-button" disabled={!hasNext || busy} onClick={() => onChange(page + 1)}>Siguiente</button></nav>;
}
export function Modal({
  title,
  children,
  onClose,
  icon: Icon = FileText,
  subtitle,
  busy = false
}) {
  const ref = useRef(null);
  const closeFromKeyboard = useEffectEvent(() => {
    if (!busy) onClose();
  });
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const dialog = ref.current;
    dialog?.focus();
    const keydown = event => {
      if (event.key === 'Escape') closeFromKeyboard();
      if (event.key === 'Tab') {
        const nodes = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]')];
        const first = nodes[0],
          last = nodes.at(-1);
        if (!first) {
          event.preventDefault();
          return;
        }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return <div className="cf-backdrop" onClick={() => !busy && onClose()}><section className="cf-modal module-dialog" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} onClick={e => e.stopPropagation()}><div className="cf-header"><span className="cf-header-icon"><Icon size={20} /></span><div className="cf-header-text"><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button type="button" className="module-dismiss" aria-label="Cerrar" disabled={busy} onClick={onClose}><X size={20} /></button></div><div className="cf-body">{busy && <Loading inline text="Procesando tu solicitud" />}{children}</div></section></div>;
}
export function ModuleLinks() {
  return <div className="module-actions"><Link className="module-button" to="/actividad">Mi actividad</Link><Link className="module-button" to="/notificaciones">Notificaciones</Link></div>;
}
