import { money, date } from '../../utils/moduleFormat';
import { useResource } from '../../hooks/useResource';
import { useState } from 'react';
import { CreditCard, CircleCheck, Clock3, SlidersHorizontal, CalendarDays, Layers3, Inbox, Info } from 'lucide-react';
import { getAdminSubscriptions } from '../../services/adminService';
import { ModulePage, Table, Badge, Feedback, Refresh, Pager } from '../../components/ModuleUI/ModuleUI';
import UserAvatar from '../../components/UserAvatar/UserAvatar';
import './AdminSubscriptions.css';

const statusLabels = { Activa: 'Activa', PorVencer: 'Por vencer', Vencida: 'Vencida', Pendiente: 'Pendiente', Cancelada: 'Cancelada', Renovada: 'Renovada' };
const userName = row => [row.usuario?.nombre, row.usuario?.apellido].filter(Boolean).join(' ') || 'Usuario no disponible';

export default function AdminSubscriptions() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const resource = useResource(() => getAdminSubscriptions({ page, limit: 20, status }), [page, status]);
  const rows = resource.data?.data || [];
  const pagination = resource.data?.pagination;
  const total = pagination?.totalRecords ?? 0;
  const summary = [
    { label: 'Suscripciones encontradas', value: total, hint: status ? `Estado: ${statusLabels[status].toLowerCase()}` : 'En todos los estados', icon: CreditCard, tone: 'blue' },
    { label: 'Activas en esta página', value: rows.filter(row => row.estado === 'Activa').length, hint: 'Dentro de los resultados visibles', icon: CircleCheck, tone: 'green' },
    { label: 'Por vencer en esta página', value: rows.filter(row => row.estado === 'PorVencer').length, hint: 'Dentro de los resultados visibles', icon: Clock3, tone: 'amber' },
  ];

  return <div className="admin-subscriptions">
    <ModulePage loading={resource.loading} title="Suscripciones" description="Supervisa los planes contratados y acompaña el ciclo de cada suscripción." actions={<Refresh onClick={resource.refresh} busy={resource.loading} />}>
      <Feedback error={resource.error} />
      {resource.data && <>
        <div className="as-stats">{summary.map(({ label, value, hint, icon: Icon, tone }) => <article className={`as-stat as-stat-${tone}`} key={label}>
          <span className="as-stat-icon"><Icon size={21} aria-hidden="true" /></span>
          <div><p>{label}</p><strong>{value.toLocaleString('es-GT')}</strong><span className="as-stat-hint">{hint}</span></div>
        </article>)}</div>
        <section className="as-directory" aria-labelledby="as-directory-title">
          <div className="as-directory-heading"><div><h2 id="as-directory-title">Registro de suscripciones</h2><p>Consulta el plan, su estado y las fechas de cada cuenta.</p></div><span className="as-result-count" role="status">{total.toLocaleString('es-GT')} {total === 1 ? 'resultado' : 'resultados'}</span></div>
          <div className="as-toolbar">
            <label className="as-filter"><span><SlidersHorizontal size={15} aria-hidden="true" />Filtrar por estado</span><select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">Todos los estados</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <p className="as-page-label">Página <strong>{page}</strong> de <strong>{Math.max(1, pagination?.totalPages || 0)}</strong></p>
          </div>
          {rows.length > 0 ? <Table rows={rows} columns={[
            { label: 'Usuario', render: row => <div className="as-user"><UserAvatar user={{ name: userName(row) }} className="as-avatar" /><div><strong>{userName(row)}</strong><p>{row.usuario?.correo || 'Correo no disponible'}</p></div></div> },
            { label: 'Plan contratado', render: row => <span className="as-plan-tag"><Layers3 size={14} aria-hidden="true" />{row.plan?.nombre || '—'}</span> },
            { label: 'Valor registrado', render: row => <span className="as-price">{row.monto_registrado == null ? 'No disponible' : money(row.monto_registrado)}</span> },
            { label: 'Estado', render: row => <span className="as-status"><>{row.estado === 'PorVencer' ? <span className="module-badge warning">Por vencer</span> : <Badge>{row.estado}</Badge>}</></span> },
            { label: 'Fecha de inicio', render: row => <span className="as-date"><CalendarDays size={14} aria-hidden="true" />{date(row.fecha_inicio)}</span> },
            { label: 'Vencimiento', render: row => Number(row.plan?.precio) === 0 ? <span className="as-no-expiry">Sin vencimiento</span> : <span className={`as-date ${row.estado === 'Vencida' ? 'as-expired' : ''}`}>{date(row.fecha_vencimiento)}</span> },
          ]} /> : <div className="as-empty"><Inbox size={32} aria-hidden="true" /><h3>No hay suscripciones para mostrar</h3><p>{status ? 'Prueba con otro estado para consultar más resultados.' : 'Las suscripciones aparecerán aquí cuando los usuarios contraten un plan.'}</p>{status && <button className="module-button" onClick={() => { setStatus(''); setPage(1); }}>Ver todos los estados</button>}</div>}
          <div className="as-directory-footer"><p>{rows.length ? `${((page - 1) * 20 + 1).toLocaleString('es-GT')}–${((page - 1) * 20 + rows.length).toLocaleString('es-GT')}` : '0'} de {total.toLocaleString('es-GT')} suscripciones</p><Pager page={page} onChange={setPage} hasNext={page < (pagination?.totalPages || 0)} busy={resource.loading} /></div>
        </section>
        <aside className="as-note"><Info size={18} aria-hidden="true" /><p>Las suscripciones de planes gratuitos no tienen vencimiento. Los indicadores de activas y por vencer corresponden a la página que estás consultando.</p></aside>
      </>}
    </ModulePage>
  </div>;
}
