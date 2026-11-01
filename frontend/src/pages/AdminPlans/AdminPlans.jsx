import { money } from '../../utils/moduleFormat';
import { useResource } from '../../hooks/useResource';
import { useState } from 'react';
import { Plus, Pencil, Layers3, HardDrive, CalendarDays, ShieldCheck, PackageCheck, PackageX, Search, Info, CircleDollarSign } from 'lucide-react';
import { getPlan, savePlan, setPlanStatus, getAdminPlans } from '../../services/planService';
import { ModulePage, Badge, Feedback, Modal, Refresh } from '../../components/ModuleUI/ModuleUI';
import './AdminPlans.css';
const blank = {
  nombre: '',
  descripcion: '',
  precio: '',
  espacio_maximo_gb: '',
  vigencia_dias: 30
};
export default function AdminPlans() {
  const resource = useResource(getAdminPlans);
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const run = async operation => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await operation();
      setForm(null);
      setStatus(null);
      setMessage('Plan actualizado correctamente.');
      resource.refresh();
      window.dispatchEvent(new Event('admin-activity-changed'));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const edit = async row => {
    setError('');
    setBusy(true);
    try {
      setForm(await getPlan(row.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const rows = (resource.data || []).filter(r => `${r.nombre} ${r.descripcion || ''}`.toLowerCase().includes(search.toLowerCase()));
  const allPlans = resource.data || [];
  const activePlans = allPlans.filter(plan => plan.id_estado === 1).length;
  return <div className="admin-plans"><ModulePage loading={resource.loading} title="Planes comerciales" description="Diseña la oferta de CloudBox y administra la disponibilidad de cada plan." actions={<><button className="module-button primary" disabled={busy} onClick={() => {
      setForm({ ...blank });
      setError('');
    }}><Plus size={17} />Crear plan</button><Refresh busy={resource.loading} onClick={resource.refresh} /></>}>
    <Feedback error={!form && !status ? error || resource.error : resource.error} message={message} />
    <div className="ap-stats">
      {[{ label: 'Planes en catálogo', value: allPlans.length, icon: Layers3, tone: 'blue' }, { label: 'Disponibles para contratar', value: activePlans, icon: PackageCheck, tone: 'green' }, { label: 'Planes desactivados', value: allPlans.length - activePlans, icon: PackageX, tone: 'amber' }].map(({ label, value, icon: Icon, tone }) => <article className={`ap-stat ap-stat-${tone}`} key={label}><span className="ap-stat-icon"><Icon size={21} aria-hidden="true" /></span><div><p>{label}</p><strong>{value.toLocaleString('es-GT')}</strong></div></article>)}
    </div>
    <section className="ap-catalog" aria-labelledby="ap-catalog-title">
      <div className="ap-catalog-heading"><div><h2 id="ap-catalog-title">Tu catálogo de planes</h2><p>Capacidad, precio y vigencia de cada opción, de un vistazo.</p></div><span className="ap-count" role="status">{rows.length} {rows.length === 1 ? 'plan' : 'planes'}</span></div>
      <label className="ap-search"><Search size={18} aria-hidden="true" /><input aria-label="Buscar planes por nombre o descripción" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o descripción…" /></label>
      <div className="ap-grid">{rows.map(plan => <article className={`ap-plan ${plan.id_estado === 1 ? '' : 'ap-plan-inactive'}`} key={plan.id}>
        <div className="ap-plan-top"><span className="ap-plan-icon"><Layers3 size={23} aria-hidden="true" /></span><Badge>{plan.estado}</Badge></div>
        <h3>{plan.nombre}</h3><p className="ap-plan-description">{plan.descripcion || 'Un espacio para guardar y organizar tus archivos.'}</p>
        <div className="ap-price"><strong>{money(plan.precio)}</strong><span>{Number(plan.precio) === 0 ? 'Sin costo' : `por ${plan.vigencia_dias} días`}</span></div>
        <ul className="ap-features"><li><HardDrive size={17} aria-hidden="true" /><span><strong>{plan.espacio_maximo_gb} GB</strong> de almacenamiento</span></li><li><CalendarDays size={17} aria-hidden="true" /><span>{Number(plan.precio) === 0 ? 'Sin vencimiento' : `${plan.vigencia_dias} días de vigencia`}</span></li><li><CircleDollarSign size={17} aria-hidden="true" /><span>{Number(plan.precio) === 0 ? 'Acceso gratuito' : 'Suscripción de pago'}</span></li></ul>
        {plan.nombre.toLowerCase() === 'free' && <p className="ap-protected"><ShieldCheck size={14} aria-hidden="true" />Plan base de CloudBox</p>}
        <div className="ap-plan-actions"><button className="module-button" disabled={busy} onClick={() => edit(plan)} aria-label={`Editar plan ${plan.nombre}`}><Pencil size={15} />Editar plan</button><button className={`module-button ap-status-button ${plan.id_estado === 1 ? 'ap-deactivate' : 'ap-activate'}`} disabled={busy || plan.nombre.toLowerCase() === 'free'} title={plan.nombre.toLowerCase() === 'free' ? 'El plan Free permanece disponible' : undefined} onClick={() => { setStatus(plan); setError(''); }} aria-label={`${plan.id_estado === 1 ? 'Desactivar' : 'Activar'} plan ${plan.nombre}`}>{plan.id_estado === 1 ? 'Desactivar' : 'Activar'}</button></div>
      </article>)}</div>
      {rows.length === 0 && <div className="ap-empty"><Search size={30} aria-hidden="true" /><h3>{search ? 'No encontramos ese plan' : 'Tu catálogo está por comenzar'}</h3><p>{search ? 'Prueba con otro nombre o descripción.' : 'Crea tu primer plan para definir la oferta de CloudBox.'}</p></div>}
    </section>
    <aside className="ap-note"><Info size={19} aria-hidden="true" /><div><strong>Cuida las condiciones de tus suscriptores</strong><p>Free conserva su capacidad y precio. Si un plan ya tiene suscripciones, crea otro para cambiar sus condiciones comerciales.</p></div></aside>
    {form && <Modal title={form.id ? 'Editar plan' : 'Crear plan'} busy={busy} onClose={() => setForm(null)}><form className="module-form" onSubmit={e => {
        e.preventDefault();
        run(() => savePlan(form.id, {
          nombre: form.nombre.trim(),
          descripcion: form.descripcion,
          precio: Number(form.precio),
          espacio_maximo_gb: Number(form.espacio_maximo_gb),
          vigencia_dias: Number(form.vigencia_dias)
        }));
      }}><Feedback error={error} />{[['nombre', 'Nombre', 'text'], ['descripcion', 'Descripción', 'text'], ['precio', 'Precio (Q)', 'number'], ['espacio_maximo_gb', 'Almacenamiento (GB)', 'number'], ['vigencia_dias', 'Vigencia (días)', 'number']].map(([key, label, type]) => <label className="module-field" key={key}>{label}<input type={type} required={key !== 'descripcion'} min={key === 'precio' ? 0 : type === 'number' ? key === 'espacio_maximo_gb' ? 0.01 : 1 : undefined} step={key === 'vigencia_dias' ? 1 : type === 'number' ? '0.01' : undefined} disabled={busy} maxLength={key === 'nombre' ? 100 : undefined} value={form[key] ?? ''} onChange={e => setForm({
            ...form,
            [key]: e.target.value
          })} /></label>)}<div className="module-actions"><button type="button" className="module-button" disabled={busy} onClick={() => setForm(null)}>Cancelar</button><button className="module-button primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar plan'}</button></div></form></Modal>}{status && <Modal title={`${status.id_estado === 1 ? 'Desactivar' : 'Activar'} plan`} busy={busy} onClose={() => setStatus(null)}><div className="module-form"><Feedback error={error} /><p>¿Confirmas el cambio de disponibilidad de «{status.nombre}»?</p><div className="module-actions"><button className="module-button" disabled={busy} onClick={() => setStatus(null)}>Volver</button><button className="module-button primary" disabled={busy} onClick={() => run(() => setPlanStatus(status.id, status.id_estado === 1 ? 2 : 1))}>Confirmar</button></div></div></Modal>}</ModulePage></div>;
}
