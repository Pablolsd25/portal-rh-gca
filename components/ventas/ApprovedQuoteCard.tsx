'use client';

import {
  ArrowPathIcon,
  CheckCircleIcon,
  CreditCardIcon,
  DocumentArrowDownIcon,
  EyeIcon,
  FolderOpenIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { clientName, formatFechaMexico, formatMoney } from '@/lib/ventas/quotes';
import type { Quote } from '@/lib/ventas/types';

type Props = {
  quote: Quote;
  onViewProofs: (quote: Quote) => void;
  onDownloadPDF: (quote: Quote) => void;
  onPreviewPDF?: (quote: Quote) => void;
  pdfLoadingQuoteId: string | null;
};

export default function ApprovedQuoteCard({
  quote,
  onViewProofs,
  onDownloadPDF,
  onPreviewPDF,
  pdfLoadingQuoteId,
}: Props) {
  const approvalDate = quote.payment_confirmed_at || quote.quote_date;
  const confirmingAdminName = quote.confirmador?.full_name || null;

  return (
    <div className="bg-white border border-green-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <UserIcon className="w-4 h-4 text-green-600 flex-shrink-0" />
            <h3 className="font-semibold text-gray-900 text-sm">{clientName(quote)}</h3>
          </div>
          <div className="flex items-center space-x-2 text-xs text-gray-500">
            <UserIcon className="w-3 h-3" />
            <span>{quote.vendedor?.full_name || 'N/A'}</span>
          </div>
        </div>
        <div className="flex items-center space-x-1 px-2 py-1 bg-green-50 rounded text-xs text-green-700">
          <CheckCircleIcon className="w-3 h-3" />
          <span>Aprobado</span>
        </div>
      </div>

      <div className="space-y-1 mb-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Fecha cotización:</span>
          <span className="text-gray-700">{formatFechaMexico(quote.quote_date)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Fecha aprobación:</span>
          <span className="text-gray-700">{formatFechaMexico(approvalDate)}</span>
        </div>
      </div>

      <div className="bg-green-50 rounded-lg p-3 mb-3 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600">Monto Total</span>
          <span className="text-lg font-bold text-gray-900">{formatMoney(quote.total_amount)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Subtotal:</span>
          <span className="text-gray-700">{formatMoney(quote.subtotal)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">IVA:</span>
          <span className="text-gray-700">{formatMoney(quote.iva_amount)}</span>
        </div>
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-center space-x-2 text-sm">
          <CreditCardIcon className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <span className="text-gray-700 capitalize">{quote.payment_method || 'N/A'}</span>
        </div>
        {quote.requires_invoice && (
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded">
            Factura
          </span>
        )}
      </div>

      {quote.numero_factura && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2 mb-3">
          <p className="text-[9px] text-indigo-700 uppercase tracking-wide mb-0.5">
            Número de Factura
          </p>
          <p className="font-mono text-sm font-bold text-indigo-900">{quote.numero_factura}</p>
        </div>
      )}

      {quote.requires_invoice &&
        (quote.metodo_de_pago_cfdi || quote.forma_de_pago_cfdi || quote.uso_cfdi) && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-2 mb-3">
            <p className="text-[9px] text-purple-700 uppercase tracking-wide mb-1 font-semibold">
              Datos CFDI
            </p>
            <div className="space-y-0.5 text-[10px] text-gray-700">
              {quote.metodo_de_pago_cfdi && <p>Método: {quote.metodo_de_pago_cfdi}</p>}
              {quote.forma_de_pago_cfdi && <p>Forma: {quote.forma_de_pago_cfdi}</p>}
              {quote.uso_cfdi && <p>Uso: {quote.uso_cfdi}</p>}
            </div>
          </div>
        )}

      {confirmingAdminName && (
        <div className="bg-gray-50 rounded-lg p-2 mb-3">
          <div className="flex items-center space-x-2">
            <CheckCircleIcon className="w-4 h-4 text-green-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500">Confirmado por:</p>
              <p className="text-sm font-medium text-gray-900 truncate">{confirmingAdminName}</p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-3">
        <button
          type="button"
          onClick={() => onViewProofs(quote)}
          className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition text-sm font-medium"
        >
          <FolderOpenIcon className="w-4 h-4" />
          <span>Ver Comprobantes ({quote.quote_payment_proofs?.length || 0})</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onPreviewPDF?.(quote)}
          disabled={pdfLoadingQuoteId === quote.id}
          className="flex items-center justify-center space-x-1 px-3 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition text-xs font-medium disabled:opacity-50"
        >
          {pdfLoadingQuoteId === quote.id ? (
            <ArrowPathIcon className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <EyeIcon className="w-4 h-4" />
              <span>Ver PDF</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => onDownloadPDF(quote)}
          disabled={pdfLoadingQuoteId === quote.id}
          className="flex items-center justify-center space-x-1 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition text-xs font-medium disabled:opacity-50"
        >
          {pdfLoadingQuoteId === quote.id ? (
            <ArrowPathIcon className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <DocumentArrowDownIcon className="w-4 h-4" />
              <span>Descargar</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
