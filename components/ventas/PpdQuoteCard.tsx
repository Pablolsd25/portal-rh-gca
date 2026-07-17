'use client';

import { useState } from 'react';
import {
  ArrowPathIcon,
  CalendarIcon,
  ChartBarIcon,
  CheckCircleIcon,
  DocumentArrowDownIcon,
  EyeIcon,
  UserIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { clientName, formatFechaMexico, formatMoney } from '@/lib/ventas/quotes';
import type { Quote } from '@/lib/ventas/types';

type PpdQuote = Quote & {
  totalPaid?: number;
  isFullyPaid?: boolean;
};

type Props = {
  quote: PpdQuote;
  onViewProofs: (quote: Quote) => void;
  onDownloadPDF: (quote: Quote) => void;
  onPreviewPDF?: (quote: Quote) => void;
  pdfLoadingQuoteId: string | null;
  showDiscardButton?: boolean;
  onDiscard?: () => void | Promise<void>;
};

function ProgressBar({ value, max }: { value: number; max: number }) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  const percentageRounded = Math.round(percentage * 100) / 100;
  const isComplete = percentageRounded >= 100;

  return (
    <div className="w-full bg-gray-200 rounded-full h-3">
      <div
        className={`h-3 rounded-full transition-all ${isComplete ? 'bg-green-600' : 'bg-blue-600'}`}
        style={{ width: `${Math.min(percentageRounded, 100)}%` }}
      />
    </div>
  );
}

export default function PpdQuoteCard({
  quote,
  onViewProofs,
  onDownloadPDF,
  onPreviewPDF,
  pdfLoadingQuoteId,
  showDiscardButton = false,
  onDiscard,
}: Props) {
  const [isDiscarding, setIsDiscarding] = useState(false);

  const totalPaid =
    quote.totalPaid ??
    (quote.quote_payment_proofs || []).reduce(
      (sum, p) => sum + (Number(p.amount_paid) || 0),
      0,
    );
  const isFullyPaid =
    quote.isFullyPaid ??
    Math.round(totalPaid * 100) / 100 >= Math.round(Number(quote.total_amount) * 100) / 100;

  const proofsWithReferenceCount =
    quote.quote_payment_proofs?.filter(p => p.reference_number).length || 0;
  const complementsCount =
    quote.quote_payment_proofs?.filter(p => p.complement_file_url).length || 0;

  const getLastActiveUser = () => {
    if (quote.confirmador?.full_name) return quote.confirmador.full_name;
    if (!quote.quote_payment_proofs?.length) return 'Sin asignar';
    const proofsWithReference = quote.quote_payment_proofs
      .filter(p => p.reference_number)
      .sort(
        (a, b) =>
          new Date(b.uploaded_at || 0).getTime() - new Date(a.uploaded_at || 0).getTime(),
      );
    if (proofsWithReference.length > 0) return 'Referencias asignadas';
    return 'Pendiente';
  };

  const getLastActivityDate = () => {
    if (!quote.quote_payment_proofs?.length) return quote.updated_at;
    const dates = quote.quote_payment_proofs.flatMap(proof =>
      [proof.uploaded_at, proof.complement_uploaded_at].filter(Boolean),
    ) as string[];
    if (dates.length > 0) {
      dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      return dates[0];
    }
    return quote.updated_at;
  };

  const handleDiscard = async () => {
    if (!onDiscard) return;
    setIsDiscarding(true);
    try {
      await onDiscard();
    } finally {
      setIsDiscarding(false);
    }
  };

  return (
    <div className="bg-white border border-blue-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <UserIcon className="w-4 h-4 text-blue-600 flex-shrink-0" />
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
        <span
          className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${
            isFullyPaid ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
          }`}
        >
          {isFullyPaid ? (
            <>
              <CheckCircleIcon className="w-3 h-3 mr-1" />
              Liquidado
            </>
          ) : (
            'En Proceso'
          )}
        </span>
      </div>

      {quote.numero_factura && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2 mb-3">
          <p className="text-[9px] text-indigo-700 uppercase tracking-wide mb-0.5">
            Número de Factura
          </p>
          <p className="font-mono text-sm font-bold text-indigo-900">{quote.numero_factura}</p>
        </div>
      )}

      {(quote.metodo_de_pago_cfdi || quote.forma_de_pago_cfdi || quote.uso_cfdi) && (
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

      <div className="bg-blue-50 rounded-lg p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-600 flex items-center">
            <ChartBarIcon className="w-3 h-3 mr-1" />
            Progreso de Pago
          </span>
          <span className="text-xs font-medium text-gray-700">
            {Math.round((totalPaid / Number(quote.total_amount || 1)) * 100)}%
          </span>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium text-gray-900">{formatMoney(totalPaid)}</span>
            <span className="text-gray-500 text-xs">/ {formatMoney(quote.total_amount)}</span>
          </div>
          <ProgressBar value={totalPaid} max={Number(quote.total_amount)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-xs text-gray-500 mb-1">Abonos</p>
          <p className="text-lg font-bold text-gray-900">{quote.quote_payment_proofs?.length || 0}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-xs text-gray-500 mb-1">Complementos</p>
          <div className="flex items-baseline space-x-1">
            <p className="text-lg font-bold text-gray-900">{complementsCount}</p>
            <p className="text-sm text-gray-500">/ {proofsWithReferenceCount}</p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
            <div
              className={`h-1.5 rounded-full transition ${
                complementsCount === proofsWithReferenceCount && proofsWithReferenceCount > 0
                  ? 'bg-green-500'
                  : 'bg-orange-500'
              }`}
              style={{
                width: `${
                  proofsWithReferenceCount > 0
                    ? (complementsCount / proofsWithReferenceCount) * 100
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-2 mb-3">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          <UserIcon className="w-4 h-4 text-gray-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500">Asignado por:</p>
            <p className="text-sm font-medium text-gray-900 truncate">{getLastActiveUser()}</p>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {getLastActivityDate() ? formatFechaMexico(getLastActivityDate()!) : 'Sin fecha'}
        </p>
      </div>

      <div className="mb-3">
        <button
          type="button"
          onClick={() => onViewProofs(quote)}
          className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition text-sm font-medium"
        >
          <EyeIcon className="w-4 h-4" />
          <span>Ver Abonos ({quote.quote_payment_proofs?.length || 0})</span>
        </button>
      </div>

      <div className={`grid ${showDiscardButton ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
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
              <span>Ver{showDiscardButton ? '' : ' PDF'}</span>
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
              <span>{showDiscardButton ? 'PDF' : 'Descargar'}</span>
            </>
          )}
        </button>

        {showDiscardButton && (
          <button
            type="button"
            onClick={() => void handleDiscard()}
            disabled={isDiscarding}
            className="flex items-center justify-center space-x-1 px-3 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition text-xs font-medium disabled:opacity-50"
          >
            {isDiscarding ? (
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <XCircleIcon className="w-4 h-4" />
                <span>Ocultar</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
