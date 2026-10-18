import { List, Grid2X2 } from "lucide-react";
import "./ViewToggle.css";

export default function ViewToggle({ value, onChange }) {
  return <div className="file-view-toggle" role="group" aria-label="Vista de archivos">
    <button type="button" className={value === "list" ? "active" : ""} aria-label="Ver en lista" title="Ver en lista" aria-pressed={value === "list"} onClick={() => onChange("list")}><List size={16} /></button>
    <button type="button" className={value === "grid" ? "active" : ""} aria-label="Ver en cuadrícula" title="Ver en cuadrícula" aria-pressed={value === "grid"} onClick={() => onChange("grid")}><Grid2X2 size={16} /></button>
  </div>;
}
