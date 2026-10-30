'use strict';
const PDFDocument = require('pdfkit');

function generatePdfBuffer(info) {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `Comprobante CloudBox ${info.number}`, Author: 'CloudBox' } });
    const parts = [];
    pdf.on('data', chunk => parts.push(chunk));
    pdf.on('error', reject);
    pdf.on('end', () => resolve(Buffer.concat(parts)));
    pdf.font('Helvetica-Bold').fontSize(23).fillColor('#163457').text('CloudBox');
    pdf.moveDown(0.3).font('Helvetica').fontSize(13).fillColor('#394f63').text('Comprobante de pago simulado');
    pdf.moveDown(1.4);
    const fields = [
      ['Número de comprobante', String(info.number)],
      ['Fecha de emisión', String(info.date)],
      ['Referencia', String(info.reference || 'No disponible')],
      ['ID de transacción', String(info.transaction || 'No disponible')],
      ['Usuario', String(info.userName || 'No disponible')],
      ['Correo', String(info.email || 'No disponible')],
      ['Plan', String(info.planName || 'No especificado')],
      ['Método de pago', String(info.methodName || 'No especificado')],
      ['Estado', 'Aprobado'],
      ['Monto', `Q ${Number(info.amount).toFixed(2)}`]
    ];
    for (const [label, value] of fields) {
      pdf.font('Helvetica-Bold').fontSize(10).fillColor('#163457').text(label);
      pdf.font('Helvetica').fontSize(11).fillColor('#222222').text(value, { width: 490 });
      pdf.moveDown(0.6);
    }
    pdf.moveDown(1.3).font('Helvetica-Oblique').fontSize(9).fillColor('#666666')
      .text('Documento generado para una transacción simulada. No es comprobante fiscal ni acredita una transferencia de fondos real.');
    pdf.end();
  });
}
module.exports = { generatePdfBuffer };
