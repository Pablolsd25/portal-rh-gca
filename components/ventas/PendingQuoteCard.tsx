'use client';

import {
  ArrowPathIcon,
  CalendarIcon,
  CheckCircleIcon,
  CreditCardIcon,
  DocumentArrowDownIcon,
  EyeIcon,
  FolderOpenIcon,
  UserIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { clientName, formatFechaMexico, formatMoney } from '@/lib/ventas/quotes';
import type { Quote } from '@/lib/ventas/types';

type Props = {
  quote: Quote;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onViewProofs: (quote: Quote) => void;
  onDownloadPDF: (quote: Quote) => void;
  onPreviewPDF?: (quote: Quote) => void;
  processingId: string | null;
  pdfLoadingQuoteId: string | null;
};

export default function PendingQuoteCard({
  quote,
  onApprove,
  onReject,
  onViewProofs,
  onDownloadPDF,
  onPreviewPDF,
  processingId,
  pdfLoadingQuoteId,
}: Props) {
  const isCreditWithPendingAbonos = quote.status === 'a_credito';

  return (
    <div className="bg-white border border-yellow-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <UserIcon className="w-4 h-4 text-yellow-600 flex-shrink-0" />
            <h3 className="font-semibold text-gray-900 text-sm">{clientName(quote)}</h3>
          </div>
          <div className="flex items-center space-x-2 text-xs text-gray-500">
            <UserIcon className="w-3 h-3" />
            <span>{quote.vendedor?.full_name || 'N/A'}</span>
          </div>
          <div className="flex items-center space-x-2 text-xs text-gray-500 mt-1">
            <CalendarIcon className="w-3 h-3" />
            <span>{formatFechaMexico(quote.quote_date)}</span>
          </div>
        </div>
      </div>

      {quote.numero_factura && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2 mb-3">
          <p className="text-[9px] text-indigo-700 uppercase tracking-wide mb-0.5">
            Número de Factura
          </p>
          <p className="font-mono text-sm font-bold text-indigo-900">{quote.numero_factura}</p>
        </div>
      )}

      <div className="bg-yellow-50 rounded-lg p-3 mb-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600">Monto Total</span>
          <span className="text-lg font-bold text-gray-900">{formatMoney(quote.total_amount)}</span>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex items-center space-x-2 mb-1 text-sm">
          <CreditCardIcon className="w-4 h-4 text-blue-600" />
          <span className="text-gray-700 capitalize">{quote.payment_method || 'N/A'}</span>
          {quote.requires_invoice && (
            <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded">
              Factura
            </span>
          )}
        </div>
        {quote.requires_invoice && (
          <div className="ml-6 space-y-0.5 text-[10px] text-gray-600">
            {quote.metodo_de_pago_cfdi && <p>Método CFDI: {quote.metodo_de_pago_cfdi}</p>}
            {quote.forma_de_pago_cfdi && <p>Forma CFDI: {quote.forma_de_pago_cfdi}</p>}
            {quote.uso_cfdi && <p>Uso CFDI: {quote.uso_cfdi}</p>}
          </div>
        )}
      </div>

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

        {!isCreditWithPendingAbonos && (
          <>
            <button
              type="button"
              onClick={() => onReject(quote.id)}
              disabled={processingId === quote.id}
              className="flex items-center justify-center space-x-1 px-3 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition text-xs font-medium disabled:opacity-50"
            >
              <XCircleIcon className="w-4 h-4" />
              <span>Rechazar</span>
            </button>
            <button
              type="button"
              onClick={() => onApprove(quote.id)}
              disabled={processingId === quote.id}
              className="flex items-center justify-center space-x-1 px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition text-xs font-medium disabled:opacity-50"
            >
              <CheckCircleIcon className="w-4 h-4" />
              <span>Aprobar</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
