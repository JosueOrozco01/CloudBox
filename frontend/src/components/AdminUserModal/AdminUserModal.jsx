import {
  Mail,
  ShieldCheck,
  UserRoundCheck,
  CreditCard,
  CalendarDays,
  HardDrive,
} from "lucide-react";
import UserAvatar from "../UserAvatar/UserAvatar";
import "./AdminUserModal.css";
import { useState } from "react";
import "../CreateFolderModal/Createfoldermodal.css";

export default function AdminUserModal({
  mode,
  user,
  roles,
  busy,
  error,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState({
    id_rol: user?.id_rol || roles[0]?.id || "",
  });
  const field = (key, value) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  const title = mode === "edit" ? "Editar permisos" : "Detalle del usuario";
  return (
    <div className="cf-backdrop">
      <form
        className="cf-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-user-title"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy) onSubmit(form);
        }}
      >
        <div className="cf-header">
          <div className="cf-header-text">
            <h2 id="admin-user-title">{title}</h2>
            <p>{user?.name}</p>
          </div>
        </div>
        <div className="cf-body">
          {mode === "edit" && (
            <label className="cf-field">
              <span>Rol del usuario</span>
              <select
                value={form.id_rol}
                disabled={busy}
                onChange={(event) => field("id_rol", event.target.value)}
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.nombre}
                  </option>
                ))}
              </select>
            </label>
          )}
          {mode === "detail" && (
            <>
              <div className="admin-user-profile">
                <UserAvatar user={user} />
                <div>
                  <h3>{user.name}</h3>
                  <p>{user.email}</p>
                </div>
              </div>
              <dl className="admin-user-details">
                {[
                  [Mail, "Correo electrónico", user.email],
                  [ShieldCheck, "Rol", user.rol?.nombre],
                  [UserRoundCheck, "Estado", user.status],
                  [CreditCard, "Plan", user.plan],
                  [CalendarDays, "Fecha de registro", user.registered],
                  [HardDrive, "Espacio utilizado", user.storage],
                ].map(([Icon, label, value]) => (
                  <div key={label}>
                    <dt>
                      <Icon size={15} />
                      {label}
                    </dt>
                    <dd>{value || "No disponible"}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
          {error && (
            <div className="cf-error" role="alert">
              {error}
            </div>
          )}
        </div>
        <div className="cf-footer">
          <button
            className="cf-cancel-btn"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            {mode === "detail" ? "Cerrar" : "Cancelar"}
          </button>
          {mode !== "detail" && (
            <button className="cf-create-btn" type="submit" disabled={busy}>
              {busy ? "Guardando…" : "Guardar permisos"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
