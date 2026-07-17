import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Credit, CreditPayment, CreditProduct } from './types';
import { calcConsolidatedBalance, outstandingBalance } from './calc';

const LUGAR_EMISION =
  'Tecámac de Felipe Villanueva, Estado de México';

type DocWithTable = jsPDF & { lastAutoTable: { finalY: number } };

const formatCurrency = (value: number | null | undefined) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(Number(value) || 0);

export type CreditPdfInput = {
  credit: Credit;
  clientName: string;
  items: CreditProduct[];
  payments: CreditPayment[];
  originalCredit?: Credit | null;
  originalItems?: CreditProduct[];
  originalPayments?: CreditPayment[];
};

export async function generateCreditPDF(data: CreditPdfInput): Promise<void> {
  const {
    credit,
    clientName,
    items,
    payments,
    originalCredit = null,
    originalItems = [],
    originalPayments = [],
  } = data;

  const doc = new jsPDF() as DocWithTable;
  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 15;
  const margin = 14;

  const emissionDateTime = new Date();
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(`Lugar de Emisión: ${LUGAR_EMISION}`, pageWidth - margin, currentY + 2, {
    align: 'right',
  });
  doc.text(
    `Fecha: ${emissionDateTime.toLocaleDateString('es-MX')}`,
    pageWidth - margin,
    currentY + 6,
    { align: 'right' },
  );
  doc.text(
    `Hora: ${emissionDateTime.toLocaleTimeString('es-MX')}`,
    pageWidth - margin,
    currentY + 10,
    { align: 'right' },
  );
  currentY += 20;

  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text('Resumen de Crédito', pageWidth / 2, currentY, { align: 'center' });
  currentY += 10;
  doc.setFontSize(10);
  doc.text(`Cliente: ${clientName}`, margin, currentY);
  doc.text(
    `Crédito ID: ${credit.id.substring(0, 13)}…`,
    pageWidth - margin,
    currentY,
    { align: 'right' },
  );
  currentY += 10;

  const outstandingOriginal = originalCredit
    ? outstandingBalance(originalCredit.total_amount_due, originalPayments)
    : 0;

  if (originalCredit) {
    doc.setFontSize(12);
    doc.setTextColor(40, 58, 117);
    doc.text('Resumen del Crédito Original Refinanciado', margin, currentY);
    currentY += 6;
    autoTable(doc, {
      startY: currentY,
      theme: 'grid',
      headStyles: { fillColor: [230, 247, 255] },
      body: [
        ['ID Original', originalCredit.id],
        ['Monto Total Original', formatCurrency(originalCredit.total_amount_due)],
        ['Saldo Pendiente Anterior', formatCurrency(outstandingOriginal)],
      ],
    });
    currentY = doc.lastAutoTable.finalY + 10;

    if (originalItems.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text('Materiales del Crédito Original', margin, currentY);
      currentY += 6;
      autoTable(doc, {
        startY: currentY,
        head: [['Cant.', 'Unid.', 'Descripción', 'P. Unit.', 'Importe']],
        body: originalItems.map(item => [
          item.quantity,
          item.unit,
          item.description,
          formatCurrency(item.unit_price),
          formatCurrency(item.subtotal),
        ]),
        theme: 'striped',
        headStyles: { fillColor: [52, 73, 94] },
      });
      currentY = doc.lastAutoTable.finalY + 10;
    }
  }

  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text(
    originalCredit ? 'Detalles del Nuevo Crédito Consolidado' : 'Resumen del Crédito',
    margin,
    currentY,
  );
  currentY += 6;

  const totalDue = Number(credit.total_amount_due) || 0;
  const requested = Number(credit.requested_amount) || 0;
  const enganche = totalDue - requested;
  const weekly = Number(credit.weekly_payment_amount) || 0;
  const combinedPayments = [...originalPayments, ...payments].sort(
    (a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime(),
  );
  const balance = calcConsolidatedBalance({
    credit,
    payments,
    originalCredit,
    originalPayments,
  });

  const summaryBody: string[][] = [];
  if (originalCredit) {
    const newCharges = totalDue - outstandingOriginal;
    summaryBody.push(['Saldo Anterior (A)', formatCurrency(outstandingOriginal)]);
    summaryBody.push(['Nuevos Cargos (B)', formatCurrency(newCharges)]);
    summaryBody.push([`Enganche Sugerido (Interés sobre B)`, formatCurrency(enganche)]);
    summaryBody.push(['Nuevo Monto Total (A+B)', formatCurrency(totalDue)]);
  } else {
    summaryBody.push(['Monto Materiales', formatCurrency(requested)]);
    summaryBody.push([
      `Enganche (Interés ${credit.interest_rate ?? 0}%)`,
      formatCurrency(enganche),
    ]);
    summaryBody.push(['Monto Total', formatCurrency(totalDue)]);
  }
  summaryBody.push(['Plazo', `${credit.payment_term_weeks ?? '—'} semanas`]);
  summaryBody.push(['Pago Semanal', formatCurrency(weekly)]);
  summaryBody.push(['Saldo Pendiente General', formatCurrency(balance)]);
  summaryBody.push(['Estado Actual', credit.status]);

  autoTable(doc, {
    startY: currentY,
    head: [['Concepto', 'Valor']],
    body: summaryBody,
    theme: 'grid',
    headStyles: { fillColor: [230, 230, 230], textColor: 40 },
    columnStyles: { 1: { halign: 'right' } },
  });
  currentY = doc.lastAutoTable.finalY + 10;

  if (items.length > 0) {
    doc.setFontSize(12);
    doc.text(
      originalCredit ? 'Nuevos Materiales del Refinanciamiento' : 'Materiales Incluidos',
      margin,
      currentY,
    );
    currentY += 6;
    autoTable(doc, {
      startY: currentY,
      head: [['Cant.', 'Unid.', 'Descripción', 'P. Unit.', 'Importe']],
      body: items.map(item => [
        item.quantity,
        item.unit,
        item.description,
        formatCurrency(item.unit_price),
        formatCurrency(item.subtotal),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [52, 73, 94] },
    });
    currentY = doc.lastAutoTable.finalY + 10;
  }

  if (combinedPayments.length > 0) {
    doc.setFontSize(12);
    doc.text('Historial de Pagos (Consolidado)', margin, currentY);
    currentY += 6;
    autoTable(doc, {
      startY: currentY,
      head: [['Fecha', 'Monto', 'Notas', 'Método', 'Registró', 'Crédito ID']],
      body: combinedPayments.map(p => [
        new Date(p.payment_date).toLocaleDateString('es-MX'),
        formatCurrency(p.amount_paid),
        p.notes || '',
        p.payment_method || '',
        p.staff_users?.full_name || 'N/D',
        `${p.credit_id.substring(0, 7)}…`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [22, 160, 133] },
    });
  }

  const safeClientName = (clientName || 'credito')
    .replace(/[^a-z0-9]/gi, '_')
    .toLowerCase();
  doc.save(`Resumen_Credito_${safeClientName}.pdf`);
}

/** Load credit + related rows and generate PDF (for list actions). */
export async function fetchAndGenerateCreditPDF(
  supabase: import('@supabase/supabase-js').SupabaseClient,
  creditId: string,
): Promise<void> {
  const { data: credit, error: creditErr } = await supabase
    .from('credits')
    .select('*, clients(id, full_name, phone_number)')
    .eq('id', creditId)
    .single();
  if (creditErr) throw creditErr;
  if (!credit) throw new Error('Crédito no encontrado');

  let originalCredit: Credit | null = null;
  let originalItems: CreditProduct[] = [];
  let originalPayments: CreditPayment[] = [];

  const refinanceId = (credit as Credit).refinanced_from_credit_id;
  if (refinanceId) {
    const { data: orig } = await supabase.from('credits').select('*').eq('id', refinanceId).single();
    if (orig) {
      originalCredit = orig as Credit;
      const [oi, op] = await Promise.all([
        supabase.from('credit_products').select('*').eq('credit_id', refinanceId),
        supabase
          .from('payments')
          .select('*, staff_users(full_name)')
          .eq('credit_id', refinanceId)
          .order('payment_date', { ascending: false }),
      ]);
      originalItems = (oi.data as CreditProduct[]) || [];
      originalPayments = (op.data as CreditPayment[]) || [];
    }
  }

  const [itemsRes, payRes] = await Promise.all([
    supabase.from('credit_products').select('*').eq('credit_id', creditId),
    supabase
      .from('payments')
      .select('*, staff_users(full_name)')
      .eq('credit_id', creditId)
      .order('payment_date', { ascending: false }),
  ]);

  await generateCreditPDF({
    credit: credit as Credit,
    clientName: credit.clients?.full_name || 'Cliente',
    items: (itemsRes.data as CreditProduct[]) || [],
    payments: (payRes.data as CreditPayment[]) || [],
    originalCredit,
    originalItems,
    originalPayments,
  });
}
