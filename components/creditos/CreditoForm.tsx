'use client';

import { formatMoney } from '@/lib/ventas/quotes';
import { products } from '@/lib/ventas/products';
import { PLAZO_MAXIMO_SEMANAS, UPLOADABLE_DOCS } from '@/lib/creditos/constants';
import type {
  CalculatedTotals,
  CreditType,
  InterestMode,
  MaterialItem,
} from '@/lib/creditos/types';

type Props = {
  clientName: string;
  loading: boolean;
  error: string | null;
  materialItems: MaterialItem[];
  onMaterialChange: (id: string, field: keyof MaterialItem, value: string) => void;
  onAddMaterial: () => void;
  onRemoveMaterial: (id: string) => void;
  onProductSelect: (id: string, description: string) => void;
  creditType: CreditType;
  onCreditTypeChange: (t: CreditType) => void;
  paymentTermWeeks: number;
  onTermChange: (w: number) => void;
  interestMode: InterestMode;
  onInterestModeChange: (m: InterestMode) => void;
  manualInterestRate: string;
  onManualInterestRateChange: (v: string) => void;
  paymentTermMonths: number;
  onPaymentTermMonthsChange: (m: number) => void;
  monthlyInterestRate: string;
  onMonthlyInterestRateChange: (v: string) => void;
  totals: CalculatedTotals;
  /** Optional docs selected before submit (nuevo) or after (detalle) */
  pendingFiles?: Record<string, File | null>;
  onFileSelect?: (docType: string, file: File | null) => void;
  submitLabel?: string;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isRefinancing?: boolean;
  originalBalance?: number;
  originalCreditId?: string | null;
  materialsTitle?: string;
  newMaterialsSubtotal?: number;
};

export default function CreditoForm({
  clientName,
  loading,
  error,
  materialItems,
  onMaterialChange,
  onAddMaterial,
  onRemoveMaterial,
  onProductSelect,
  creditType,
  onCreditTypeChange,
  paymentTermWeeks,
  onTermChange,
  interestMode,
  onInterestModeChange,
  manualInterestRate,
  onManualInterestRateChange,
  paymentTermMonths,
  onPaymentTermMonthsChange,
  monthlyInterestRate,
  onMonthlyInterestRateChange,
  totals,
  pendingFiles,
  onFileSelect,
  submitLabel = 'Guardar solicitud',
  onCancel,
  onSubmit,
  isRefinancing = false,
  originalBalance = 0,
  originalCreditId = null,
  materialsTitle,
  newMaterialsSubtotal,
}: Props) {
  const weekOptions = Array.from({ length: PLAZO_MAXIMO_SEMANAS - 3 }, (_, i) => i + 4);

  return (
    <form onSubmit={onSubmit} className="space-y-6 bg-white border border-slate-200 rounded-xl p-5">
      <h2 className="text-lg font-semibold text-slate-800">Solicitud para: {clientName}</h2>

      {isRefinancing && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2 text-sm">
          <p className="font-semibold text-blue-900">Resumen de refinanciamiento</p>
          <p className="text-blue-800">
            Saldo pendiente anterior:{' '}
            <strong>{formatMoney(originalBalance)}</strong>
          </p>
          {originalCreditId && (
            <p className="text-xs text-blue-700 font-mono">Crédito original: {originalCreditId}</p>
          )}
          <p className="text-xs text-blue-700">
            Agrega solo materiales nuevos; el saldo anterior se consolida automáticamente.
          </p>
        </div>
      )}

      <fieldset className="border border-slate-200 rounded-lg p-4">
        <legend className="text-sm font-medium text-slate-700 px-1">Tipo de financiamiento</legend>
        <div className="flex flex-wrap gap-4 mt-1">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="creditType"
              checked={creditType === 'por_plazo'}
              onChange={() => onCreditTypeChange('por_plazo')}
              disabled={loading}
            />
            Por plazo (enganche = interés)
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="creditType"
              checked={creditType === 'mensual'}
              onChange={() => onCreditTypeChange('mensual')}
              disabled={loading}
            />
            Tasa mensual
          </label>
        </div>
      </fieldset>

      {creditType === 'por_plazo' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Plazo (semanas)</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={paymentTermWeeks}
              onChange={e => onTermChange(parseInt(e.target.value, 10))}
              disabled={loading || interestMode === 'manual'}
            >
              {weekOptions.map(w => (
                <option key={w} value={w}>
                  {w} semanas
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="block text-sm font-medium text-slate-700 mb-1">Interés</span>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={interestMode === 'auto'}
                  onChange={() => onInterestModeChange('auto')}
                  disabled={loading}
                />
                Automático
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={interestMode === 'manual'}
                  onChange={() => onInterestModeChange('manual')}
                  disabled={loading}
                />
                Manual (%)
              </label>
              {interestMode === 'manual' && (
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  value={manualInterestRate}
                  onChange={e => onManualInterestRateChange(e.target.value)}
                  disabled={loading}
                  placeholder="ej. 30"
                />
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Plazo (meses)</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={paymentTermMonths}
              onChange={e => onPaymentTermMonthsChange(parseInt(e.target.value, 10))}
              disabled={loading}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>
                  {m} {m === 1 ? 'mes' : 'meses'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Tasa mensual (%)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={monthlyInterestRate}
              onChange={e => onMonthlyInterestRateChange(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-800">
            {materialsTitle || (isRefinancing ? 'Nuevos materiales' : 'Materiales')}
          </h3>
          <button
            type="button"
            onClick={onAddMaterial}
            disabled={loading}
            className="text-xs font-medium text-rose-700 hover:underline"
          >
            + Agregar fila
          </button>
        </div>
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-2 py-2 text-left">Producto</th>
                <th className="px-2 py-2 text-left w-20">Cant.</th>
                <th className="px-2 py-2 text-left w-20">Unid.</th>
                <th className="px-2 py-2 text-left w-28">P. unit.</th>
                <th className="px-2 py-2 text-right w-28">Subtotal</th>
                <th className="px-2 py-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {materialItems.map(item => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-2 py-1.5">
                    <input
                      list={`products-${item.id}`}
                      className="w-full border border-slate-200 rounded px-2 py-1 text-sm min-w-[160px]"
                      value={item.description}
                      onChange={e => {
                        onMaterialChange(item.id, 'description', e.target.value);
                        onProductSelect(item.id, e.target.value);
                      }}
                      disabled={loading}
                      placeholder="Descripción"
                    />
                    <datalist id={`products-${item.id}`}>
                      {products.map(p => (
                        <option key={p.description} value={p.description} />
                      ))}
                    </datalist>
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="w-full border border-slate-200 rounded px-2 py-1 text-sm"
                      value={item.quantity}
                      onChange={e => onMaterialChange(item.id, 'quantity', e.target.value)}
                      disabled={loading}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      className="w-full border border-slate-200 rounded px-2 py-1 text-sm"
                      value={item.unit}
                      onChange={e => onMaterialChange(item.id, 'unit', e.target.value)}
                      disabled={loading}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="w-full border border-slate-200 rounded px-2 py-1 text-sm"
                      value={item.unitPrice}
                      onChange={e => onMaterialChange(item.id, 'unitPrice', e.target.value)}
                      disabled={loading}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right font-medium text-slate-700">
                    {formatMoney(item.subtotal)}
                  </td>
                  <td className="px-2 py-1.5">
                    {materialItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onRemoveMaterial(item.id)}
                        disabled={loading}
                        className="text-red-600 text-xs hover:underline"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 bg-slate-50 rounded-lg p-4 text-sm">
        {isRefinancing && (
          <>
            <div>
              <p className="text-slate-500">Saldo anterior</p>
              <p className="font-semibold text-slate-800">{formatMoney(originalBalance)}</p>
            </div>
            <div>
              <p className="text-slate-500">Nuevos materiales</p>
              <p className="font-semibold text-slate-800">
                {formatMoney(newMaterialsSubtotal ?? 0)}
              </p>
            </div>
          </>
        )}
        <div>
          <p className="text-slate-500">{isRefinancing ? 'Principal consolidado' : 'Subtotal'}</p>
          <p className="font-semibold text-slate-800">{formatMoney(totals.subtotal)}</p>
        </div>
        <div>
          <p className="text-slate-500">
            Interés ({totals.interestRatePercent}
            {creditType === 'mensual' ? '%/mes' : '%'})
          </p>
          <p className="font-semibold text-slate-800">{formatMoney(totals.interest)}</p>
        </div>
        <div>
          <p className="text-slate-500">Total a pagar</p>
          <p className="font-semibold text-rose-700">{formatMoney(totals.totalDue)}</p>
        </div>
        <div>
          <p className="text-slate-500">Pago semanal (ref.)</p>
          <p className="font-semibold text-slate-800">{formatMoney(totals.weeklyPayment)}</p>
        </div>
      </div>

      {onFileSelect && pendingFiles && (
        <div className="border border-slate-200 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Documentos</h3>
          <p className="text-xs text-slate-500">
            Se subirán al guardar la solicitud (bucket documentos-creditos).
          </p>
          {UPLOADABLE_DOCS.map(doc => (
            <div key={doc.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-slate-700 min-w-[200px]">{doc.label}</span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                disabled={loading}
                onChange={e => onFileSelect(doc.id, e.target.files?.[0] ?? null)}
                className="text-xs"
              />
              {pendingFiles[doc.id] && (
                <span className="text-xs text-rose-700 truncate max-w-[160px]">
                  {pendingFiles[doc.id]?.name}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading || totals.totalDue <= 0}
          className="px-4 py-2 text-sm bg-rose-600 text-white rounded-lg font-medium hover:bg-rose-700 disabled:opacity-50"
        >
          {loading ? 'Guardando…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
