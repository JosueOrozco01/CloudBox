import { Cloud } from "lucide-react";
import "./Loading.css";

export default function Loading({ text = "Cargando tu espacio", description = "Estamos preparando tu información.", fullScreen = true, inline = false }) {
  return <div className={`loading-${inline ? 'inline' : fullScreen ? 'page' : 'overlay'}`} role="status" aria-live="polite" aria-busy="true"><div className="loading-content"><span className="loading-symbol" aria-hidden="true"><span className="loading-orbit" /><Cloud size={32} strokeWidth={1.7} /><i /></span><div className="loading-copy"><strong className="loading-text">{text}</strong>{description && <span className="loading-description">{description}</span>}</div><span className="loading-track" aria-hidden="true"><span /></span></div></div>;
}
