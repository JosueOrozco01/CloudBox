import StorageBar from '../../components/StorageBar/StorageBar';
import { formatStorageBytes, formatStoragePercent, storagePercentage } from '../../utils/storageUsage';
import { useResource } from '../../hooks/useResource';
import { useState } from 'react';
import { HardDrive, Files, FolderOpen, UsersRound, SlidersHorizontal, Info, Inbox, Layers3 } from 'lucide-react';
import { getStorageOverview, getStorageUsers } from '../../services/adminService';
import { ModulePage, Table, Feedback, Refresh, Pager } from '../../components/ModuleUI/ModuleUI';
import UserAvatar from '../../components/UserAvatar/UserAvatar';
import './AdminStorage.css';

export default function AdminStorage() {
  const [overQuota, setOverQuota] = useState(false);
  const [page, setPage] = useState(1);
  const resource = useResource(async () => {
    const [summary, users] = await Promise.all([getStorageOverview(), getStorageUsers({ overQuota, limit: 20, offset: (page - 1) * 20 })]);
    return { summary, users: users.data, pagination: users.pagination };
  }, [overQuota, page]);
  const data = resource.data;
  const total = data?.pagination?.total || 0;
  const rows = data?.users || [];
  const summary = data ? [
    { label: 'Espacio utilizado', value: formatStorageBytes(data.summary.totalBytes), icon: HardDrive, tone: 'blue' },
    { label: 'Archivos almacenados', value: Number(data.summary.totalFiles).toLocaleString('es-GT'), icon: Files, tone: 'purple' },
    { label: 'Carpetas', value: Number(data.summary.totalFolders).toLocaleString('es-GT'), icon: FolderOpen, tone: 'amber' },
    { label: overQuota ? 'Usuarios sobre cuota' : 'Usuarios en la consulta', value: total.toLocaleString('es-GT'), icon: UsersRound, tone: 'green' },
  ] : [];
  const types = [
    { key: 'pdf', label: 'PDF', color: '#df7383' },
    { key: 'imagenes', label: 'Imágenes', color: '#648fe5' },
    { key: 'documentos', label: 'Documentos', color: '#9674d6' },
    { key: 'otros', label: 'Otros archivos', color: '#3fa795' },
  ].map(type => ({ ...type, ...data?.summary.distributionByType?.[type.key] }));

  return <div className="admin-storage"><ModulePage loading={resource.loading} title="Almacenamiento" description="Conoce cómo se utiliza el espacio de CloudBox y detecta las cuentas que necesitan atención." actions={<Refresh onClick={resource.refresh} busy={resource.loading} />}>
    <Feedback error={resource.error} />
    {data && <>
      <div className="ast-stats">{summary.map(({ label, value, icon: Icon, tone }) => <article className={`ast-stat ast-stat-${tone}`} key={label}><span className="ast-stat-icon"><Icon size={21} aria-hidden="true" /></span><div><p>{label}</p><strong>{value}</strong></div></article>)}</div>
      {data.summary.distributionByType && <section className="ast-distribution" aria-labelledby="ast-types-title"><div className="ast-section-heading"><div><h2 id="ast-types-title">¿Qué ocupa el espacio?</h2><p>Distribución del almacenamiento por tipo de archivo.</p></div><HardDrive size={22} aria-hidden="true" /></div>
        {data.summary.totalBytes > 0 ? <div className="ast-type-track" role="img" aria-label={types.map(type => `${type.label}: ${formatStorageBytes(type.bytes || 0)}`).join(', ')}>{types.map(type => <span key={type.key} style={{ width: `${((type.bytes || 0) / data.summary.totalBytes) * 100}%`, background: type.color }} />)}</div> : <p className="ast-no-files">Todavía no hay espacio ocupado por archivos.</p>}
        <ul className="ast-type-list">{types.map(type => <li key={type.key}><span className="ast-type-dot" style={{ background: type.color }} /><div><span>{type.label}</span><strong>{formatStorageBytes(type.bytes || 0)}</strong><small>{Number(type.count ?? type.cantidad ?? 0).toLocaleString('es-GT')} {Number(type.count ?? type.cantidad ?? 0) === 1 ? 'archivo' : 'archivos'}</small></div></li>)}</ul>
      </section>}
      <section className="ast-directory" aria-labelledby="ast-users-title"><div className="ast-section-heading"><div><h2 id="ast-users-title">Consumo por usuario</h2><p>Compara el espacio ocupado con la capacidad de cada plan.</p></div><span className="ast-count" role="status">{total.toLocaleString('es-GT')} {total === 1 ? 'usuario' : 'usuarios'}</span></div>
        <div className="ast-toolbar"><label className="ast-filter"><span><SlidersHorizontal size={15} aria-hidden="true" />Mostrar usuarios</span><select value={overQuota ? 'over' : 'all'} onChange={event => { setOverQuota(event.target.value === 'over'); setPage(1); }}><option value="all">Todos los usuarios</option><option value="over">Solo usuarios sobre cuota</option></select></label><div className="ast-legend"><span><i className="ast-normal" />Menos del 80 %</span><span><i className="ast-warning" />Desde el 80 %</span><span><i className="ast-danger" />Sobre cuota</span></div></div>
        {rows.length ? <Table rows={rows} rowKey="id_usuario" columns={[
          { label: 'Usuario', render: row => <div className="ast-user"><UserAvatar user={{ name: row.nombre_completo }} className="ast-avatar" /><div><strong>{row.nombre_completo || 'Usuario no disponible'}</strong><p>{row.correo || 'Correo no disponible'}</p></div></div> },
          { label: 'Plan', render: row => <span className="ast-plan"><Layers3 size={14} aria-hidden="true" />{row.plan}</span> },
          { label: 'Utilizado', render: row => <strong className="ast-bytes">{formatStorageBytes(row.usedBytes)}</strong> },
          { label: 'Capacidad', render: row => <span className="ast-capacity">{formatStorageBytes(row.maxBytes)}</span> },
          { label: 'Uso de cuota', render: row => {
            const percent = storagePercentage(row.usedBytes, row.maxBytes, row.percentageUsed);
            return <div className={`ast-usage ${row.overQuota ? 'is-over' : percent >= 80 ? 'is-warning' : ''}`}><div><strong>{formatStoragePercent(percent)}</strong>{row.overQuota && <span>Sobre cuota</span>}</div><StorageBar className="ast-usage-track" label={`Uso de cuota de ${row.nombre_completo}`} usedBytes={row.usedBytes} totalBytes={row.maxBytes} percentage={percent} /></div>;
          } },
          { label: 'Archivos', render: row => <span className="ast-number">{Number(row.fileCount || 0).toLocaleString('es-GT')}</span> },
          { label: 'Carpetas', render: row => <span className="ast-number">{Number(row.folderCount || 0).toLocaleString('es-GT')}</span> },
        ]} /> : <div className="ast-empty"><Inbox size={32} aria-hidden="true" /><h3>{overQuota ? 'No hay usuarios sobre cuota' : 'No hay usuarios para mostrar'}</h3><p>{overQuota ? 'Ninguna cuenta supera su capacidad en esta consulta.' : 'El consumo de las cuentas aparecerá aquí.'}</p>{overQuota && <button className="module-button" onClick={() => { setOverQuota(false); setPage(1); }}>Ver todos los usuarios</button>}</div>}
        <div className="ast-footer"><p>{rows.length ? `${(page - 1) * 20 + 1}–${(page - 1) * 20 + rows.length}` : '0'} de {total.toLocaleString('es-GT')} usuarios</p><Pager page={page} onChange={setPage} hasNext={page * 20 < total} busy={resource.loading} /></div>
      </section>
      <aside className="ast-note"><Info size={19} aria-hidden="true" /><div><strong>Cómo se calcula el consumo</strong><p>El almacenamiento en papelera también ocupa cuota. La capacidad asignada por plan no representa el espacio físico disponible del servidor.</p></div></aside>
    </>}
  </ModulePage></div>;
}
