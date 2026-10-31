import { ArchiveRestore, FileText, RotateCcw, Trash2 } from "lucide-react";
import "./TrashOverview.css";

export default function TrashOverview() {
  return <section className="trash-hero" aria-labelledby="trash-hero-title"><div className="trash-hero-copy"><span className="trash-eyebrow"><ArchiveRestore size={16} />UN ESPACIO PARA RECONSIDERAR</span><h2 id="trash-hero-title">¿Lo necesitas de vuelta?<br /><span>Dale una segunda oportunidad.</span></h2><p>Encuentra lo que enviaste a la papelera y recupera los archivos o carpetas que todavía tienen algo que contar.</p><div className="trash-hero-hint"><RotateCcw size={14} /><span>Restaurar está a un clic de distancia.</span></div></div><div className="trash-hero-art" aria-hidden="true"><span className="trash-orbit" /><span className="trash-art-bin"><Trash2 size={59} strokeWidth={1.25} /></span><span className="trash-art-file"><FileText size={21} /></span><span className="trash-art-restore"><RotateCcw size={22} /></span><span className="trash-art-caption">Todavía hay otra oportunidad</span></div></section>;
}

export function TrashGuidance() {
  return <div className="trash-guidance"><div className="trash-guide restore"><span><RotateCcw size={19} /></span><div><h3>Recupera lo que importa</h3><p>Usa Restaurar para devolver archivos y carpetas a tu espacio.</p></div></div><div className="trash-guide permanent"><span><Trash2 size={19} /></span><div><h3>Elige qué dejar atrás</h3><p>La eliminación permanente está disponible para archivos y no se puede deshacer.</p></div></div></div>;
}
