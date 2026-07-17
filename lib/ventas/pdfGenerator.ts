import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Quote, QuoteItem } from './types';
import { IVA_RATE } from './types';

const LUGAR_EMISION_PDF_TECAMAC =
  '1a. Cda. de Nicolás Bravo s/n, Nueva Sta Maria, 55740 Tecámac de Felipe Villanueva, Méx.';
const LUGAR_EMISION_PDF_PERALVILLO =
  'C. Melesio Morales 9, Peralvillo, Cuauhtémoc, 06220 Ciudad de México, CDMX';

const LEYENDAS_PAGO: Record<
  string,
  { nombrePDF: string; datosBancarios: string[]; leyendasGenerales: string[] }
> = {
  ADRIAN_CASTRO: {
    nombrePDF: 'ADRIAN CASTRO SALAZAR',
    datosBancarios: [
      'ADRIAN CASTRO SALAZAR // CTA. SANTANDER 92001504819 // CLABE BANCARIA 014180920015048195',
    ],
    leyendasGenerales: [
      'PRECIOS SUJETOS A CAMBIO SIN PREVIO AVISO',
      'PAGOS POR TRANSFERENCIA DE BBVA A BANORTE PUEDEN TARDAR HASTA 12 HRS EN REFLEJARSE',
      'ENVÍO SIN COSTO DE FLETE DENTRO DE LA ZONA METROPOLITANA Y EDO DE MEXICO *APLICA RESTRICCIONES.',
    ],
  },
  SIGLO_XXI: {
    nombrePDF: 'ACEROS Y MATERIALES SIGLO XXI',
    datosBancarios: [
      'ACEROS Y MATERIALES SIGLO XXI // CTA. SANTANDER 92000392644 // CLABE BANCARIA 014180920003926449',
      'ACEROS Y MATERIALES SIGLO XXI // CTA. BANORTE 0572442839 // CLABE BANCARIA 072180005724428390',
    ],
    leyendasGenerales: [
      'PRECIOS SUJETOS A CAMBIO SIN PREVIO AVISO',
      'PAGOS POR TRANSFERENCIA DE BBVA A BANORTE PUEDEN TARDAR HASTA 12 HRS EN REFLEJARSE',
      'ENVÍO SIN COSTO DE FLETE DENTRO DE LA ZONA METROPOLITANA Y EDO DE MEXICO *APLICA RESTRICCIONES.',
    ],
  },
};

type PdfQuote = Quote & { items: QuoteItem[] };

const formatCurrency = (value: number | null | undefined) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(Number(value) || 0);

const formatStatus = (status: string | null | undefined) => {
  if (!status) return 'No disponible';
  const formatted = status.replace(/_/g, ' ');
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

const getClientAddress = (q: PdfQuote) => {
  const client = q.clients;
  const parts = [
    [client?.address_street, client?.address_number].filter(Boolean).join(' '),
    client?.address_neighborhood,
    client?.address_city,
    client?.address_state,
    client?.address_postal_code ? `C.P. ${client.address_postal_code}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : q.delivery_address || '';
};

type DocWithTable = jsPDF & { lastAutoTable: { finalY: number } };

export async function generateQuotePDF(
  quoteDataForPdf: PdfQuote,
  currentUserFullName = 'No disponible',
  sucursal = 'tecamac',
  returnDoc = false,
): Promise<jsPDF | void> {
  if (!quoteDataForPdf?.items?.length) {
    throw new Error('No hay datos de cotización válidos para generar el PDF.');
  }

  const { items, ...quoteDetailsPdf } = quoteDataForPdf;
  const doc = new jsPDF() as DocWithTable;
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 15;
  const margin = 14;

  // Logo omitido si no está disponible en este portal

  const lowerCaseSucursal = (sucursal || '').toLowerCase();
  const lugarEmision =
    lowerCaseSucursal === 'peralvillo'
      ? LUGAR_EMISION_PDF_PERALVILLO
      : LUGAR_EMISION_PDF_TECAMAC;

  const emissionDateTime = new Date(quoteDetailsPdf.quote_date || Date.now());
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(`Lugar de Emisión: ${lugarEmision}`, pageWidth - margin, currentY + 2, { align: 'right' });
  doc.text(
    `Fecha: ${emissionDateTime.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}`,
    pageWidth - margin,
    currentY + 6,
    { align: 'right' },
  );
  doc.text(`Cotización ID: ${quoteDetailsPdf.id.substring(0, 8)}...`, pageWidth - margin, currentY + 10, {
    align: 'right',
  });
  doc.text(`Estado: ${formatStatus(quoteDetailsPdf.status)}`, pageWidth - margin, currentY + 14, {
    align: 'right',
  });

  currentY += 25;

  doc.setFontSize(18);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  doc.text('COTIZACIÓN', pageWidth / 2, currentY, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  currentY += 12;

  doc.setFontSize(10);
  const clientNameToDisplay =
    quoteDataForPdf.clients?.full_name || quoteDataForPdf.client_name_temporary || 'N/A';
  doc.text(`Cliente: ${clientNameToDisplay}`, margin, currentY);
  currentY += 7;

  const clientPhoneToDisplay =
    quoteDataForPdf.clients?.phone_number || quoteDataForPdf.client_phone_temporary;
  if (clientPhoneToDisplay) {
    doc.text(`Teléfono: ${clientPhoneToDisplay}`, margin, currentY);
    currentY += 7;
  }

  const clientAddressToDisplay = getClientAddress(quoteDataForPdf);
  if (clientAddressToDisplay) {
    const addressLines = doc.splitTextToSize(`Dirección: ${clientAddressToDisplay}`, pageWidth - margin * 2);
    doc.text(addressLines, margin, currentY);
    currentY += addressLines.length * 5 + 2;
  }

  const staffCreatorNameToDisplay = quoteDataForPdf.vendedor?.full_name || currentUserFullName;
  doc.text(`Atención: ${staffCreatorNameToDisplay}`, margin, currentY);
  currentY += 7;

  if (quoteDetailsPdf.requires_invoice) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Detalles de Facturación:', margin, currentY);
    currentY += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    for (const line of [
      `Uso CFDI: ${quoteDetailsPdf.uso_cfdi || 'N/A'}`,
      `Método de pago: ${quoteDetailsPdf.metodo_de_pago_cfdi || 'N/A'}`,
      `Forma de pago: ${quoteDetailsPdf.forma_de_pago_cfdi || 'N/A'}`,
    ]) {
      doc.text(line, margin + 2, currentY);
      currentY += 4;
    }
    currentY += 3;
  }

  const paymentReferences = quoteDetailsPdf.quote_payment_proofs
    ?.map(p => p.reference_number)
    .filter(Boolean) as string[] | undefined;

  if (paymentReferences?.length) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Referencias de Pago:', margin, currentY);
    currentY += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    for (const ref of paymentReferences) {
      doc.text(`- ${ref}`, margin + 2, currentY);
      currentY += 4;
    }
    currentY += 3;
  }

  autoTable(doc, {
    startY: currentY,
    head: [['Cant.', 'Unid.', 'Descripción', 'P. Unit.', 'Importe']],
    body: items.map(item => [
      item.quantity,
      item.unit,
      item.description,
      formatCurrency(item.unit_price),
      formatCurrency(item.subtotal_item),
    ]),
    theme: 'striped',
    headStyles: { fillColor: [22, 160, 133] },
  });
  currentY = doc.lastAutoTable.finalY + 8;

  const totalsX = pageWidth - margin - 50;
  doc.setFontSize(10);
  doc.text('Subtotal:', totalsX, currentY, { align: 'left' });
  doc.text(formatCurrency(quoteDataForPdf.subtotal), pageWidth - margin, currentY, { align: 'right' });
  currentY += 6;
  doc.text(`IVA (${(IVA_RATE * 100).toFixed(0)}%):`, totalsX, currentY, { align: 'left' });
  doc.text(formatCurrency(quoteDataForPdf.iva_amount), pageWidth - margin, currentY, { align: 'right' });
  currentY += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Total General:', totalsX, currentY, { align: 'left' });
  doc.text(formatCurrency(quoteDataForPdf.total_amount), pageWidth - margin, currentY, { align: 'right' });
  currentY += 10;

  const leyendaSeleccionada = LEYENDAS_PAGO[String(quoteDataForPdf.payment_profile_type || '')];
  if (leyendaSeleccionada) {
    doc.setFontSize(7.5);
    doc.setTextColor(100);
    if (currentY > pageHeight - 40) {
      doc.addPage();
      currentY = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.text(leyendaSeleccionada.nombrePDF, pageWidth / 2, currentY, { align: 'center' });
    currentY += 4;
    doc.setFont('helvetica', 'normal');
    for (const linea of leyendaSeleccionada.datosBancarios) {
      doc.text(linea, pageWidth / 2, currentY, { align: 'center' });
      currentY += 3.5;
    }
    currentY += 1.5;
    for (const linea of leyendaSeleccionada.leyendasGenerales) {
      doc.text(linea, pageWidth / 2, currentY, { align: 'center' });
      currentY += 3.5;
    }
  }

  const safeClientName = (clientNameToDisplay || 'Cotizacion').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  if (returnDoc) return doc;
  doc.save(`Cotizacion_${safeClientName}_${quoteDataForPdf.id.substring(0, 8)}.pdf`);
}
