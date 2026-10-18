import { useEffect, useId, useState } from "react";
import { Check, Search, UserRound } from "lucide-react";
import { request } from "../../services/dashboardService";

export default function RecipientPicker({ value, onChange, disabled }) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState({ query: "", users: [], error: "" });
  const query = value.trim().toLowerCase();
  useEffect(() => {
    if (query.length < 2 || !focused || disabled) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const users = await request(`/shares/recipients?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!controller.signal.aborted) setResult({ query, users, error: "" });
      } catch {
        if (!controller.signal.aborted) setResult({ query, users: [], error: "No se pudieron cargar las sugerencias. Puedes escribir el correo completo." });
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, focused, disabled, retry]);
  const users = result.query === query ? result.users : [];
  const open = focused && query.length >= 2 && !disabled;
  const pending = result.query !== query;
  const choose = user => { onChange(user.correo); setFocused(false); setActive(-1); };
  const keyDown = event => {
    if (event.key === "Escape" && open) { event.stopPropagation(); setFocused(false); setActive(-1); return; }
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && query.length >= 2) {
      event.preventDefault(); setFocused(true);
      if (users.length) setActive(index => event.key === "ArrowDown" ? (index + 1) % users.length : (index <= 0 ? users.length - 1 : index - 1));
    }
    if (event.key === "Enter" && open && active >= 0 && users[active]) { event.preventDefault(); choose(users[active]); }
  };
  return <div className="cf-field sc-recipient-field">
    <label htmlFor={id}>Correo del destinatario</label>
    <div className="sc-recipient-input"><Search size={16} aria-hidden="true" /><input id={id} required disabled={disabled} type="email" autoComplete="off" placeholder="Busca por correo electrónico" value={value} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={open ? `${id}-list` : undefined} aria-activedescendant={open && users[active] ? `${id}-option-${active}` : undefined} aria-describedby={`${id}-help`} onChange={event => { onChange(event.target.value); setFocused(true); setActive(-1); }} onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); setActive(-1); }} onKeyDown={keyDown} /></div>
    {open && <div className="sc-recipient-popover">
      <div className="sc-recipient-heading">Usuarios registrados <span>Hasta 8 coincidencias</span></div>
      <ul id={`${id}-list`} role="listbox" aria-label="Destinatarios sugeridos" aria-busy={pending}>
        {!pending && users.map((user, index) => <li key={user.correo} id={`${id}-option-${index}`} role="option" aria-selected={active === index} className={active === index ? "active" : ""} onMouseDown={event => event.preventDefault()} onClick={() => choose(user)}>
          <span className="sc-recipient-avatar"><UserRound size={18} /></span><span className="sc-recipient-person"><strong>{[user.nombre, user.apellido].filter(Boolean).join(" ") || user.correo}</strong><span>{user.correo}</span></span>{value === user.correo && <Check size={16} />}
        </li>)}
      </ul>
      <div className="sc-recipient-status" role="status">{pending ? "Buscando usuarios…" : result.error ? <>{result.error} <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => setRetry(n => n + 1)}>Reintentar</button></> : !users.length ? "No hay usuarios activos que coincidan con ese correo." : "Selecciona una persona o usa las flechas y Enter."}</div>
    </div>}
    <small id={`${id}-help`} className="sc-field-help">Escribe al menos 2 caracteres. Solo se muestran otras cuentas activas.</small>
  </div>;
}
