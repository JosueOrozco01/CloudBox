import "../Payments/Payments.css";
import { getRevenue } from "../../services/adminService";
import { getPayment, getReceiptDownload } from "../../services/paymentService";
import PaymentDetail from "../Payments/PaymentDetail";
import { money } from '../../utils/moduleFormat';
import { useResource } from '../../hooks/useResource';
import { useState } from 'react';
import { Download, BarChart3, SlidersHorizontal, Info } from 'lucide-react';
import { exportReport, getReport } from '../../services/reportService';
import { ModulePage, Panel, Stats, Table, Feedback, Refresh } from '../../components/ModuleUI/ModuleUI';
import './AdminReports.css';
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
  const metric = ['ingresos', 'total', 'cantidad', 'nuevosUsuarios', 'nuevas', 'totalBytes', 'bytes', 'totalGb', 'gb'].find(key => rows.some(row => typeof row[key] === 'number'));
  const nameKey = ['plan', 'mes', 'estado', 'rol', 'tipo', 'extension', 'nombre'].find(key => rows.some(row => row[key] != null));
  const maximum = metric ? Math.max(0, ...rows.map(row => Number(row[metric]) || 0)) : 0;
  return <Panel title={title}>{metric && nameKey && maximum > 0 && <div className="ar-chart" aria-label={`${title}: comparación por ${labels[metric] || metric}`}>{rows.map((row, index) => <div className="ar-chart-row" key={row.id ?? index}><div><span>{String(row[nameKey] ?? '—')}</span><strong>{monetary(metric) || metric === 'total' && title.startsWith('Ingresos') ? money(row[metric]) : Number(row[metric] || 0).toLocaleString('es-GT')}</strong></div><div className="ar-chart-track"><span style={{ width: `${Math.max(0, Number(row[metric]) || 0) / maximum * 100}%` }} /></div></div>)}</div>}<Table rows={rows} columns={keys.map(key => ({
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
  const [detail,setDetail]=useState(null);
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
  const revenue=useResource(()=>applied.type==='revenue' ? getRevenue({startDate:applied.from,endDate:applied.to}) : Promise.resolve(null),[applied]);
  const inspectPayment=async(id,download=false)=>{if(busy)return;setBusy(true);setError('');try{if(download){window.location.assign((await getReceiptDownload(id)).url);}else setDetail({receipt:false,paymentId:id,data:await getPayment(id)});}catch(error){setError(error.message);}finally{setBusy(false);}};
  const data = resource.data;
  const stats = data?.kpis || data?.resumen;
  const sections = data ? applied.type === 'overview' ? [['Usuarios por estado', data.usuarios?.distribucionEstado], ['Usuarios por rol', data.usuarios?.distribucionRol], ['Suscripciones por plan', data.suscripciones?.distribucionPlanes], ['Ingresos por mes', data.ingresos?.desgloseMensual], ['Ingresos por plan', data.ingresos?.ingresosPorPlan], ['Almacenamiento por tipo', data.almacenamiento?.distribucionTipo]] : applied.type === 'subscriptions' ? [['Distribución por plan', data.distribucionPlanes], ['Tendencia mensual', data.tendenciaMensual]] : applied.type === 'revenue' ? [['Ingresos por mes', data.desgloseMensual], ['Ingresos por plan', data.ingresosPorPlan]] : applied.type === 'users' ? [['Usuarios por estado', data.distribucionEstado], ['Usuarios por rol', data.distribucionRol], ['Registros por mes', data.tendenciaMensual]] : [['Almacenamiento por tipo', data.distribucionTipo], ['Almacenamiento por estado', data.distribucionEstado]] : [];
  return <div className="admin-reports"><ModulePage loading={resource.loading} eyebrow="ADMINISTRACIÓN" title="Métricas y reportes" description="Consulta indicadores de CloudBox y exporta reportes del período seleccionado." actions={<><button className="module-button" disabled={busy || resource.loading || !data} onClick={() => download('csv')}><Download size={16} />CSV</button><button className="module-button primary" disabled={busy || resource.loading || !data} onClick={() => download('pdf')}><Download size={16} />PDF</button><Refresh onClick={() => {resource.refresh();revenue.refresh();}} busy={resource.loading} /></>}><section className="ar-filter-panel"><div className="ar-filter-heading"><SlidersHorizontal size={18} aria-hidden="true" /><div><h2>Explora tus indicadores</h2><p>Elige un reporte y el período que quieres consultar.</p></div></div><form className="module-filters" onSubmit={e => {
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
        })} /></label>)}<button className="module-button primary">Consultar</button></form></section><Feedback error={error || resource.error || revenue.error} /><p className="ar-period" style={{
      marginBottom: 20
    }}><BarChart3 size={16} aria-hidden="true" />{types[applied.type]} · {applied.type === 'storage' ? 'Estado actual, sin filtro de fechas' : `${applied.from || 'Desde el inicio'} — ${applied.to || 'Hasta hoy'}`}</p>{stats && <Stats items={Object.entries(stats).map(([key, value]) => [labels[key] || key, monetary(key) ? money(value) : value])} />}{data?.consumoGlobal && <Stats items={[['Espacio utilizado (GB)', data.consumoGlobal.totalGb], ['Archivos', data.consumoGlobal.totalArchivos], ['Carpetas', data.consumoGlobal.totalCarpetas], ['Promedio por usuario (GB)', data.promedioPorUsuario?.gb], ['Usuarios sobre cuota', data.alertasCuota.totalSobreCuota], ['Usuarios próximos a cuota', data.alertasCuota.totalProximosCuota]]} />}{data?.almacenamiento?.promedioPorUsuarioGb != null && <Stats items={[["Promedio por usuario (GB)",data.almacenamiento.promedioPorUsuarioGb]]} />}
    {data?.alertasCuota && <div className="module-grid">{[['Usuarios sobre cuota',data.alertasCuota.usuariosSobreCuota],['Usuarios próximos a cuota',data.alertasCuota.usuariosProximosCuota]].map(([title,users])=><Panel title={title} key={title}><Table rows={users} columns={[{label:'Usuario',key:'nombre_completo'},{label:'Correo',key:'correo'},{label:'Uso',render:user=>`${user.percentageUsed}%`}]} /></Panel>)}</div>}
    {applied.type==='revenue' && <Panel title="Transacciones aprobadas del período"><Table rows={revenue.data?.transacciones} columns={[{label:'Referencia',key:'referencia'},{label:'Fecha',key:'fecha_pago'},{label:'Plan',render:row=>row.suscripcion?.plan?.nombre||'—'},{label:'Monto',render:row=>money(row.monto)},{label:'Acciones',render:row=><div className="module-actions"><button className="module-button" disabled={busy} onClick={()=>inspectPayment(row.id)}>Detalle</button><button className="module-button" disabled={busy} onClick={()=>inspectPayment(row.id,true)}>Comprobante</button></div>}]} /></Panel>}
    <div className="module-grid">{sections.map(([title, rows]) => <Distribution key={title} title={title} rows={rows} />)}</div><p className="ar-note"><Info size={18} aria-hidden="true" />Los ingresos corresponden a pagos simulados aprobados con monto positivo. El almacenamiento refleja el estado actual.</p>{detail && <PaymentDetail detail={detail} busy={busy} error={error} onClose={()=>setDetail(null)} onDownload={()=>inspectPayment(detail.paymentId,true)} />}</ModulePage></div>;
}
