import { money } from '../../utils/moduleFormat';
import { useResource } from '../../hooks/useResource';
import { useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { getPlan, savePlan, setPlanStatus, getAdminPlans } from '../../services/planService';
import { ModulePage, Panel, Table, Badge, Feedback, Modal, Refresh } from '../../components/ModuleUI/ModuleUI';
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
  return <ModulePage loading={resource.loading} eyebrow="ADMINISTRACIÓN" title="Planes comerciales" description="Administra el catálogo y la disponibilidad de los planes de CloudBox." actions={<><button className="module-button primary" disabled={busy} onClick={() => {
      setForm({
        ...blank
      });
      setError('');
    }}><Plus size={16} />Crear plan</button><Refresh busy={resource.loading} onClick={resource.refresh} /></>}><Feedback error={!form && !status ? error || resource.error : resource.error} message={message} /><div className="module-filters"><label className="module-field">Buscar plan<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Nombre o descripción" /></label></div><Panel title="Catálogo de planes"><Table rows={rows} columns={[{
        label: 'Plan',
        key: 'nombre'
      }, {
        label: 'Precio',
        render: r => money(r.precio)
      }, {
        label: 'Capacidad',
        render: r => `${r.espacio_maximo_gb} GB`
      }, {
        label: 'Vigencia',
        render: r => r.precio === 0 ? 'Sin vencimiento' : `${r.vigencia_dias} días`
      }, {
        label: 'Estado',
        render: r => <Badge>{r.estado}</Badge>
      }, {
        label: 'Acciones',
        render: r => <div className="module-actions"><button className="module-button" disabled={busy} onClick={() => edit(r)}><Pencil size={14} />Editar</button><button className="module-button" disabled={busy || r.nombre.toLowerCase() === 'free'} onClick={() => {
            setStatus(r);
            setError('');
          }}>{r.id_estado === 1 ? 'Desactivar' : 'Activar'}</button></div>
      }]} /></Panel><p className="module-muted">Free conserva su capacidad y precio. Si un plan ya tiene suscripciones, crea otro para cambiar sus condiciones comerciales.</p>{form && <Modal title={form.id ? 'Editar plan' : 'Crear plan'} busy={busy} onClose={() => setForm(null)}><form className="module-form" onSubmit={e => {
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
          })} /></label>)}<div className="module-actions"><button type="button" className="module-button" disabled={busy} onClick={() => setForm(null)}>Cancelar</button><button className="module-button primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar plan'}</button></div></form></Modal>}{status && <Modal title={`${status.id_estado === 1 ? 'Desactivar' : 'Activar'} plan`} busy={busy} onClose={() => setStatus(null)}><div className="module-form"><Feedback error={error} /><p>¿Confirmas el cambio de disponibilidad de «{status.nombre}»?</p><div className="module-actions"><button className="module-button" disabled={busy} onClick={() => setStatus(null)}>Volver</button><button className="module-button primary" disabled={busy} onClick={() => run(() => setPlanStatus(status.id, status.id_estado === 1 ? 2 : 1))}>Confirmar</button></div></div></Modal>}</ModulePage>;
}
