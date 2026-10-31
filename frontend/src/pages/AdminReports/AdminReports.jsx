import { money } from '../../utils/moduleFormat';
import { useResource } from '../../hooks/useResource';
import { useState } from 'react';
import { Download } from 'lucide-react';
import { exportReport, getReport } from '../../services/reportService';
import { ModulePage, Panel, Stats, Table, Feedback, Refresh } from '../../components/ModuleUI/ModuleUI';
const types = {
  overview: 'Resumen general',
  subscriptions: 'Suscripciones',
  revenue: 'Ingresos simulados',
  users: 'Usuarios',
  storage: 'Almacenamiento'
};
const labels = {
  totalUsuarios: 'Usuarios registrados',
  nuevosUsuariosPeriodo: 'Nuevos usuarios',
  suscripcionesVigentes: 'Suscripciones vigentes',
  suscripcionesPorVencer: 'Suscripciones por vencer',
  suscripcionesVencidas: 'Suscripciones vencidas',
  ingresosTotales: 'Ingresos simulados',
  totalTransacciones: 'Transacciones aprobadas',
  espacioConsumidoGb: 'Espacio utilizado (GB)',
  usuariosSobreCuota: 'Usuarios sobre cuota',
  totalSuscripciones: 'Total de suscripciones',
  vigentes: 'Vigentes',
  porVencer: 'Por vencer',
  vencidas: 'Vencidas',
  pendientes: 'Pendientes',
  canceladas: 'Canceladas',
  ticketPromedio: 'Importe promedio',
  totalPeriodo: 'Nuevos usuarios en el período',
  totalHistorico: 'Total de usuarios',
  plan: 'Plan',
  cantidad: 'Cantidad',
  porcentaje: 'Porcentaje',
  mes: 'Mes',
  nuevas: 'Nuevas',
  nuevosUsuarios: 'Nuevos usuarios',
  ingresos: 'Ingresos',
  total: 'Total',
  transacciones: 'Transacciones',
  estado: 'Estado',
  rol: 'Rol',
  tipo: 'Tipo',
  extension: 'Extensión',
  bytes: 'Espacio (bytes)',
  gb: 'Espacio (GB)',
  totalBytes: 'Espacio (bytes)',
  totalGb: 'Espacio (GB)',
  totalArchivos: 'Archivos',
  totalCarpetas: 'Carpetas',
  nombre: 'Nombre',
  espacio_bytes: 'Espacio (bytes)',
  espacio_gb: 'Espacio (GB)',
  ingresosTotalesPlan: 'Ingresos'
};
const monetary = key => /ingres|ticket|monto/i.test(key);
function Distribution({
  title,
  rows: source
}) {
  const rows = Array.isArray(source) ? source : Object.entries(source || {}).map(([tipo, value]) => ({
    tipo,
    ...value
  }));
  const keys = [...new Set((rows || []).flatMap(row => Object.keys(row)))].filter(key => key !== 'id' && key !== 'count' && !key.startsWith('id_') && (rows || []).some(row => row[key] !== null && typeof row[key] !== 'object'));
  return <Panel title={title}><Table rows={rows} columns={keys.map(key => ({
      label: key === 'total' && title.startsWith('Ingresos') ? 'Ingresos' : labels[key] || key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2'),
      render: row => monetary(key) || key === 'total' && title.startsWith('Ingresos') ? money(row[key]) : row[key] ?? '—'
    }))} /></Panel>;
}
export default function AdminReports() {
  const [filters, setFilters] = useState({
    type: 'overview',
    from: '',
    to: ''
  });
  const [applied, setApplied] = useState(filters);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const resource = useResource(() => getReport(applied), [applied]);
  const download = async format => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await exportReport({
        ...applied,
        format
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const data = resource.data;
  const stats = data?.kpis || data?.resumen;
  const sections = data ? applied.type === 'overview' ? [['Usuarios por estado', data.usuarios?.distribucionEstado], ['Usuarios por rol', data.usuarios?.distribucionRol], ['Suscripciones por plan', data.suscripciones?.distribucionPlanes], ['Ingresos por mes', data.ingresos?.desgloseMensual], ['Ingresos por plan', data.ingresos?.ingresosPorPlan], ['Almacenamiento por tipo', data.almacenamiento?.distribucionTipo]] : applied.type === 'subscriptions' ? [['Distribución por plan', data.distribucionPlanes], ['Tendencia mensual', data.tendenciaMensual]] : applied.type === 'revenue' ? [['Ingresos por mes', data.desgloseMensual], ['Ingresos por plan', data.ingresosPorPlan]] : applied.type === 'users' ? [['Usuarios por estado', data.distribucionEstado], ['Usuarios por rol', data.distribucionRol], ['Registros por mes', data.tendenciaMensual]] : [['Almacenamiento por tipo', data.distribucionTipo], ['Almacenamiento por estado', data.distribucionEstado]] : [];
  return <ModulePage loading={resource.loading} eyebrow="ADMINISTRACIÓN" title="Métricas y reportes" description="Consulta indicadores de CloudBox y exporta reportes del período seleccionado." actions={<><button className="module-button" disabled={busy || resource.loading || !data} onClick={() => download('csv')}><Download size={16} />CSV</button><button className="module-button primary" disabled={busy || resource.loading || !data} onClick={() => download('pdf')}><Download size={16} />PDF</button><Refresh onClick={resource.refresh} busy={resource.loading} /></>}><form className="module-filters" onSubmit={e => {
      e.preventDefault();
      setApplied({
        ...filters
      });
    }}><label className="module-field">Reporte<select value={filters.type} onChange={e => setFilters({
          ...filters,
          type: e.target.value
        })}>{Object.entries(types).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>{['from', 'to'].map(key => <label className="module-field" key={key}>{key === 'from' ? 'Desde' : 'Hasta'}<input type="date" disabled={filters.type === 'storage'} min={key === 'to' ? filters.from || undefined : undefined} max={key === 'from' ? filters.to || undefined : undefined} value={filters[key]} onChange={e => setFilters({
          ...filters,
          [key]: e.target.value
        })} /></label>)}<button className="module-button primary">Consultar</button></form><Feedback error={error || resource.error} /><p className="module-muted" style={{
      marginBottom: 20
    }}>{types[applied.type]} · {applied.type === 'storage' ? 'Estado actual, sin filtro de fechas' : `${applied.from || 'Desde el inicio'} — ${applied.to || 'Hasta hoy'}`}</p>{stats && <Stats items={Object.entries(stats).map(([key, value]) => [labels[key] || key, monetary(key) ? money(value) : value])} />}{data?.consumoGlobal && <Stats items={[['Espacio utilizado (GB)', data.consumoGlobal.totalGb], ['Archivos', data.consumoGlobal.totalArchivos], ['Usuarios sobre cuota', data.alertasCuota.totalSobreCuota], ['Usuarios próximos a cuota', data.alertasCuota.totalProximosCuota]]} />}<div className="module-grid">{sections.map(([title, rows]) => <Distribution key={title} title={title} rows={rows} />)}</div><p className="module-muted">Los ingresos corresponden a pagos simulados aprobados con monto positivo. El almacenamiento refleja el estado actual.</p></ModulePage>;
}
