import { Activity, Download, FolderPlus, Share2, Trash2, Upload } from "lucide-react";

export const activityActions = ["Crear carpeta", "Subir archivo", "Descargar archivo", "Eliminar archivo", "Compartir archivo", "Compartir carpeta", "Eliminar carpeta"];
const presentation = {
  "Crear carpeta": { icon: FolderPlus, tone: "amber", category: "Carpetas" },
  "Subir archivo": { icon: Upload, tone: "blue", category: "Archivos" },
  "Descargar archivo": { icon: Download, tone: "green", category: "Archivos" },
  "Eliminar archivo": { icon: Trash2, tone: "rose", category: "Papelera" },
  "Compartir archivo": { icon: Share2, tone: "violet", category: "Compartidos" },
  "Compartir carpeta": { icon: Share2, tone: "violet", category: "Compartidos" },
  "Eliminar carpeta": { icon: Trash2, tone: "rose", category: "Papelera" },
};
export const activityPresentation = row => presentation[row.accion?.nombre] || { icon: Activity, tone: "blue", category: "Tu cuenta" };
export const activityTime = value => value && String(value).length > 10 && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" }) : null;
