import { money, date } from "../../utils/moduleFormat";
import { useResource } from "../../hooks/useResource";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCheck, CircleCheck, CircleX, CreditCard, Download, Eye, FileText, History, ReceiptText, Search, X } from "lucide-react";
import { getPayments, getPayment, getReceipt, getReceiptDownload } from "../../services/paymentService";
import { ModulePage, Panel, Table, Badge, Feedback, Refresh, Empty } from "../../components/ModuleUI/ModuleUI";
import PaymentDetail from "./PaymentDetail";
import "./Payments.css";

const statusName = payment => payment.paymentStatusId === 1 ? "Aprobado" : payment.paymentStatusId === 2 ? "Rechazado" : "Otro estado";

export default function Payments() {
  const resource = useResource(getPayments);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const open = async (row, receipt = false, download = false) => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      if (download) {
        const result = await getReceiptDownload(row.id);
        window.location.assign(result.url);
      } else setDetail({ receipt, paymentId: row.id, data: receipt ? await getReceipt(row.id) : await getPayment(row.id) });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const rows = resource.data || [];
  const approved = rows.filter(row => row.paymentStatusId === 1);
  const rejected = rows.filter(row => row.paymentStatusId === 2);
  const latest = [...approved].sort((a, b) => (Date.parse(b.paidAt) || 0) - (Date.parse(a.paidAt) || 0) || b.id - a.id)[0];
  const filtered = rows.filter(row => (status === "all" || String(row.paymentStatusId) === status) && `${row.referenceCode || ""} ${row.transactionId || ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  const loaded = resource.data !== null;

  return <ModulePage loading={resource.loading} title="Pagos y comprobantes" description="Tus operaciones en orden. Tus comprobantes, siempre a mano." actions={<><Link className="module-button primary" to="/plan"><CreditCard size={15} />Administrar mi plan</Link><Refresh onClick={resource.refresh} busy={resource.loading} /></>}>
    <Feedback error={error || resource.error} />
    
    <div className="payments-overview">
      <section className="payments-summary" aria-labelledby="payments-summary-title"><div className="payments-summary-top"><span><CreditCard size={17} />TUS PAGOS EN CLOUDBOX</span><span className="payments-simulated">Pagos simulados</span></div><p id="payments-summary-title">Total aprobado</p><strong className="payments-total">{loaded ? money(approved.reduce((sum, row) => sum + Number(row.amount), 0)) : '—'}</strong><span className="payments-summary-caption">En las últimas {loaded ? rows.length : '—'} operaciones consultadas.</span><div className="payments-summary-bottom"><span><CheckCheck size={17} />Solo incluye operaciones aprobadas</span><Link to="/plan">Ver mi plan<ArrowRight size={14} /></Link></div><ReceiptText className="payments-summary-art" size={130} strokeWidth={.8} aria-hidden="true" /></section>
      <section className="payments-latest" aria-labelledby="payments-latest-title"><div className="payments-latest-heading"><span className="payments-receipt-icon"><ReceiptText size={22} /></span><div><h2 id="payments-latest-title">Tu último pago aprobado</h2><p>Un acceso rápido a su comprobante.</p></div></div>{latest ? <><div className="payments-latest-amount"><strong>{money(latest.amount)}</strong><Badge>Aprobado</Badge></div><dl className="payments-latest-info"><div><dt>Fecha</dt><dd>{date(latest.paidAt)}</dd></div><div><dt>Referencia</dt><dd>{latest.referenceCode || '—'}</dd></div></dl><button className="module-button" disabled={busy} onClick={() => open(latest, true, true)}><Download size={15} />Descargar último comprobante</button></> : <div className="payments-latest-empty"><FileText size={28} /><p>{loaded ? 'Tu próximo pago aprobado aparecerá aquí.' : 'El resumen estará disponible al cargar tus pagos.'}</p></div>}</section>
    </div>
    <div className="payments-metrics">{[[History, "Operaciones consultadas", rows.length, "Hasta las últimas 100 operaciones", "blue"], [CircleCheck, "Pagos aprobados", approved.length, "Comprobantes disponibles para consultar", "green"], [CircleX, "Pagos rechazados", rejected.length, "Consulta el detalle de cada intento", "rose"]].map(([Icon, label, value, caption, color]) => <div className="payments-metric" key={label}><span className={`payments-metric-icon ${color}`}><Icon size={21} /></span><div><span>{label}</span><strong>{loaded ? value : '—'}</strong><p>{caption}</p></div></div>)}</div>
    <section className="payments-history" aria-labelledby="payments-history-title"><div className="payments-section-heading"><div><span className="payments-kicker">CADA OPERACIÓN, EN UN SOLO LUGAR</span><h2 id="payments-history-title">Historial de pagos</h2><p>Revisa los detalles o descarga el comprobante que necesitas.</p></div><span className="payments-result-count" role="status">{filtered.length} {filtered.length === 1 ? "operación" : "operaciones"}</span></div>
      <div className="payments-filters"><label className="payments-search"><Search size={17} /><span className="payments-sr-only">Buscar por referencia o transacción</span><input type="search" placeholder="Buscar por referencia o transacción…" value={search} onChange={event => setSearch(event.target.value)} />{search && <button type="button" aria-label="Limpiar búsqueda de pagos" onClick={() => setSearch("")}><X size={15} /></button>}</label><label className="payments-status-filter"><span>Estado</span><select value={status} onChange={event => setStatus(event.target.value)}><option value="all">Todos los estados</option><option value="1">Aprobados</option><option value="2">Rechazados</option></select></label></div>
      <Panel>{!resource.loading && !resource.error && !filtered.length ? <Empty>{rows.length ? 'No hay pagos que coincidan con tu búsqueda.' : 'Todavía no tienes pagos registrados. Aquí encontrarás tus próximas operaciones.'}</Empty> : <Table rows={filtered} columns={[
        { label: "Referencia", render: row => <div className="payments-reference"><span><ReceiptText size={18} /></span><div><strong>{row.referenceCode || 'Sin referencia'}</strong><small>Operación de suscripción</small></div></div> },
        { label: "Fecha", render: row => date(row.paidAt) },
        { label: "Monto", render: row => <strong className="payments-table-amount">{money(row.amount)}</strong> },
        { label: "Estado", render: row => <Badge>{statusName(row)}</Badge> },
        { label: "Acciones", render: row => <div className="payments-row-actions"><button className="module-button" disabled={busy} onClick={() => open(row)}><Eye size={14} />Detalle</button><button className="module-button" disabled={busy || row.paymentStatusId !== 1} onClick={() => open(row, true)}><FileText size={14} />Comprobante</button><button className="module-button payments-pdf" disabled={busy || row.paymentStatusId !== 1} onClick={() => open(row, true, true)}><Download size={14} />PDF</button></div> },
      ]} />}</Panel>
    </section>
    <div className="payments-note"><ReceiptText size={16} /><p>Los pagos de CloudBox son simulados. Los comprobantes se emiten para operaciones aprobadas.</p></div>
    {detail && <PaymentDetail detail={detail} busy={busy} error={error} onClose={() => setDetail(null)} onDownload={() => open({ id: detail.paymentId }, true, true)} />}
  </ModulePage>;
}
