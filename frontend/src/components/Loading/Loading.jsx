import { RefreshCw } from "lucide-react";
import "./Loading.css";

export default function Loading({ text = "Cargando tu espacio", description = "Estamos preparando tu información.", fullScreen = true, inline = false }) {
  return <div className={`loading-${inline ? 'inline' : fullScreen ? 'page' : 'overlay'}`} role="status" aria-live="polite" aria-busy="true"><div className="loading-content"><RefreshCw className="loading-arrows" size={26} aria-hidden="true" /><strong className="loading-text">{text}</strong>{description && <span className="loading-description">{description}</span>}</div></div>;
}
