import { Cloud } from "lucide-react";
import "./Loading.css";

// Full-page loaders stay invisible for `delay` ms so fast navigations feel instant;
// the loading screen only appears when something actually takes long.
export default function Loading({ text = "Cargando tu espacio", description = "Estamos preparando tu información.", fullScreen = true, inline = false, delay = 300 }) {
  const variant = inline ? 'inline' : fullScreen ? 'page' : 'overlay';
  const style = variant === 'page' ? { '--loading-delay': `${delay}ms` } : undefined;
  return <div className={`loading-${variant}${delay === 0 ? " loading-blocking" : ""}`} style={style} role="status" aria-live="polite" aria-busy="true"><div className="loading-content"><span className="loading-symbol" aria-hidden="true"><span className="loading-orbit" /><Cloud size={32} strokeWidth={1.7} /><i /></span><div className="loading-copy"><strong className="loading-text">{text}</strong>{description && <span className="loading-description">{description}</span>}</div><span className="loading-track" aria-hidden="true"><span /></span></div></div>;
}
