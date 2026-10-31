import { money, date } from '../../utils/moduleFormat';
import { useResource } from '../../hooks/useResource';
import { useState } from 'react';
import { getAdminSubscriptions } from '../../services/adminService';
import { ModulePage, Panel, Table, Badge, Feedback, Refresh, Pager } from '../../components/ModuleUI/ModuleUI';
export default function AdminSubscriptions() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const resource = useResource(() => getAdminSubscriptions({
    page,
    limit: 20,
    status
  }), [page, status]);
  return <ModulePage loading={resource.loading} eyebrow="ADMINISTRACIÓN" title="Suscripciones" description="Consulta los planes contratados, su estado y fechas de vigencia." actions={<Refresh onClick={resource.refresh} busy={resource.loading} />}><div className="module-filters"><label className="module-field">Estado<select value={status} onChange={e => {
          setStatus(e.target.value);
          setPage(1);
        }}><option value="">Todos los estados</option>{['Activa', 'PorVencer', 'Vencida', 'Pendiente', 'Cancelada', 'Renovada'].map(s => <option key={s}>{s}</option>)}</select></label></div><Feedback error={resource.error} /><Panel title={`Suscripciones ${resource.data?.pagination ? `(${resource.data.pagination.totalRecords})` : ''}`}><Table rows={resource.data?.data} columns={[{
        label: 'Usuario',
        render: r => <><strong>{[r.usuario?.nombre, r.usuario?.apellido].filter(Boolean).join(' ') || 'Usuario no disponible'}</strong><p className="module-muted">{r.usuario?.correo}</p></>
      }, {
        label: 'Plan',
        render: r => r.plan?.nombre || '—'
      }, {
        label: 'Precio',
        render: r => money(r.plan?.precio)
      }, {
        label: 'Estado',
        render: r => <Badge>{r.estado}</Badge>
      }, {
        label: 'Inicio',
        render: r => date(r.fecha_inicio)
      }, {
        label: 'Vencimiento',
        render: r => Number(r.plan?.precio) === 0 ? 'Sin vencimiento' : date(r.fecha_vencimiento)
      }]} /><Pager page={page} onChange={setPage} hasNext={page < (resource.data?.pagination?.totalPages || 0)} busy={resource.loading} /></Panel></ModulePage>;
}
