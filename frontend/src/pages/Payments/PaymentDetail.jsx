import { CalendarDays, CheckCheck, CreditCard, Download, FileText, Hash, ReceiptText } from "lucide-react";
import { Modal, Badge, Feedback } from "../../components/ModuleUI/ModuleUI";
import { date, money } from "../../utils/moduleFormat";

export default function PaymentDetail({ detail, busy, error, onClose, onDownload }) {
  const { data, receipt } = detail;
  const approved = receipt || data.paymentStatusId === 1;
  const fields = receipt
    ? [[Hash, "Número de comprobante", data.receiptNumber], [CalendarDays, "Fecha de emisión", date(data.issuedAt)]]
    : [[Hash, "Referencia", data.referenceCode], [FileText, "Transacción", data.transactionId], [CalendarDays, "Fecha del pago", date(data.paidAt)]];
  return <Modal title={receipt ? "Comprobante de pago" : "Detalle del pago"} subtitle="Tu operación en CloudBox" icon={receipt ? ReceiptText : CreditCard} busy={busy} onClose={onClose}>
    <Feedback error={error} />
    <div className="payment-detail-summary"><span className="payment-detail-symbol"><ReceiptText size={26} /></span><span>{receipt ? "Monto del comprobante" : "Monto de la operación"}</span><strong>{money(data.amount)}</strong><Badge>{approved ? 'Aprobado' : data.paymentStatusId === 2 ? 'Rechazado' : 'Otro estado'}</Badge></div>
    <dl className="payment-detail-fields">{fields.map(([Icon, label, value]) => <div key={label}><dt><Icon size={14} />{label}</dt><dd>{value || '—'}</dd></div>)}</dl>
    <div className="payment-detail-note"><CheckCheck size={15} /><span>{receipt ? 'Comprobante de una operación simulada.' : 'Información de una operación simulada.'}</span></div>
    <div className="module-form"><div className="module-actions"><button type="button" className="module-button" disabled={busy} onClick={onClose}>Cerrar</button>{approved && <button type="button" className="module-button primary" disabled={busy} onClick={onDownload}><Download size={15} />{busy ? 'Preparando…' : 'Descargar PDF'}</button>}</div></div>
  </Modal>;
}
