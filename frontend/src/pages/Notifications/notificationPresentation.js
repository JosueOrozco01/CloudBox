import { Bell, CreditCard, FolderOpen, HardDrive, Share2, ShieldAlert, Sparkles, Timer } from "lucide-react";

export function notificationPresentation(row) {
  if (row.tipo === "ACCESS_REVOKED") return { icon: ShieldAlert, label: "Acceso actualizado", tone: "rose", category: "shared" };
  if (row.tipo === "SUBSCRIPTION_EXPIRING") return { icon: Timer, label: "Tu suscripción", tone: "amber", category: "plans" };
  if (row.tipo === "PAYMENT_APPROVED" || row.tipo_recurso === "pago") return { icon: CreditCard, label: "Pago", tone: "green", category: "plans" };
  if (row.tipo === "SUBSCRIPTION_ACTIVATED" || row.tipo_recurso === "suscripcion") return { icon: Sparkles, label: "Tu plan", tone: "blue", category: "plans" };
  if (row.tipo === "STORAGE_NEAR_LIMIT" || row.tipo_recurso === "almacenamiento") return { icon: HardDrive, label: "Almacenamiento", tone: "amber", category: "storage" };
  if (row.tipo === "FOLDER_SHARED" || row.tipo_recurso === "carpeta") return { icon: FolderOpen, label: "Carpeta compartida", tone: "violet", category: "shared" };
  if (row.tipo === "FILE_SHARED" || row.tipo_recurso === "archivo") return { icon: Share2, label: "Compartido contigo", tone: "violet", category: "shared" };
  return { icon: Bell, label: "CloudBox", tone: "blue", category: "other" };
}
export const notificationDestination = type => ["archivo", "carpeta"].includes(type) ? "/compartidos" : type === "pago" ? "/pagos" : ["suscripcion", "almacenamiento"].includes(type) ? "/plan" : null;
