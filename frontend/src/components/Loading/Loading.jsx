import "./Loading.css";

export default function Loading({ text = "Cargando...", fullScreen = true }) {
  return (
    <div className={fullScreen ? "loading-page" : "loading-overlay"} role="status" aria-live="polite" aria-busy="true">
      <div className="loading-content">
        <span className="loading-spinner" aria-hidden="true" />
        <p className="loading-text">{text}</p>
      </div>
    </div>
  );
}
