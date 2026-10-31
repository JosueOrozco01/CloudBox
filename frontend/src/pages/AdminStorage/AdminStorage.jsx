import { useResource } from '../../hooks/useResource';
import { useState } from 'react';
import { getStorageOverview, getStorageUsers } from '../../services/adminService';
import { ModulePage, Panel, Stats, Table, Badge, Feedback, Refresh, Pager } from '../../components/ModuleUI/ModuleUI';
import { formatFileSize } from '../../utils/preferences';
export default function AdminStorage() {
  const [overQuota, setOverQuota] = useState(false);
  const [page, setPage] = useState(1);
  const resource = useResource(async () => {
    const [summary, users] = await Promise.all([getStorageOverview(), getStorageUsers({
      overQuota,
      limit: 20,
      offset: (page - 1) * 20
    })]);
    return {
      summary,
      users: users.data,
      pagination: users.pagination
    };
  }, [overQuota, page]);
  const data = resource.data;
  return <ModulePage loading={resource.loading} eyebrow="ADMINISTRACIÓN" title="Almacenamiento" description="Supervisa el consumo de espacio y detecta cuentas que exceden su capacidad." actions={<Refresh onClick={resource.refresh} busy={resource.loading} />}><Feedback error={resource.error} />{data && <Stats items={[['Espacio utilizado', formatFileSize(data.summary.totalBytes)], ['Archivos almacenados', data.summary.totalFiles], ['Carpetas', data.summary.totalFolders], ['Usuarios en esta consulta', data.pagination?.total]]} />}<div className="module-filters"><label className="module-field">Usuarios<select value={overQuota ? 'over' : 'all'} onChange={e => {
          setOverQuota(e.target.value === 'over');
          setPage(1);
        }}><option value="all">Todos los usuarios</option><option value="over">Solo usuarios sobre cuota</option></select></label></div><Panel title="Consumo por usuario"><Table rows={data?.users} columns={[{
        label: 'Usuario',
        render: r => <><strong>{r.nombre_completo}</strong><p className="module-muted">{r.correo}</p></>
      }, {
        label: 'Plan',
        key: 'plan'
      }, {
        label: 'Utilizado',
        render: r => formatFileSize(r.usedBytes)
      }, {
        label: 'Capacidad',
        render: r => formatFileSize(r.maxBytes)
      }, {
        label: 'Uso',
        render: r => <Badge>{Number(r.percentageUsed).toFixed(1)} %{r.overQuota ? ' · Sobre cuota' : ''}</Badge>
      }, {
        label: 'Archivos',
        key: 'fileCount'
      }, {
        label: 'Carpetas',
        key: 'folderCount'
      }]} /><Pager page={page} onChange={setPage} hasNext={page * 20 < (data?.pagination?.total || 0)} busy={resource.loading} /></Panel><p className="module-muted">El almacenamiento en papelera también ocupa cuota. La capacidad asignada por plan no representa el espacio físico disponible del servidor.</p></ModulePage>;
}
