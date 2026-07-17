'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { createClient } from '@/lib/supabase/client';
import { products } from '@/lib/ventas/products';
import { generateQuotePDF } from '@/lib/ventas/pdfGenerator';
import { formatMoney, saveQuote, updateQuote } from '@/lib/ventas/quotes';
import { IVA_RATE, type FrequentClient, type Quote, type QuoteStatus } from '@/lib/ventas/types';

type LineItem = {
  key: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
};

type Props = {
  userId: string;
  userName: string;
  userSucursal: string | null;
  initialQuote: Quote | null;
  frequentClients: FrequentClient[];
  prefill?: { nombre?: string; telefono?: string; direccion?: string };
};

const PAYMENT_PROFILES = [
  { id: 'ADRIAN_CASTRO', nombreDisplay: 'ADRIAN CASTRO SALAZAR' },
  { id: 'SIGLO_XXI', nombreDisplay: 'ACEROS Y MATERIALES SIGLO XXI' },
] as const;

function newLine(): LineItem {
  return { key: crypto.randomUUID(), description: '', quantity: '', unit: '', unitPrice: '' };
}

function linesFromQuote(q: Quote | null): LineItem[] {
  const items = q?.items || q?.quote_items || [];
  if (!items.length) return [newLine()];
  return items.map(i => ({
    key: crypto.randomUUID(),
    description: i.description || '',
    quantity: String(i.quantity ?? ''),
    unit: i.unit || '',
    unitPrice: String(i.unit_price ?? ''),
  }));
}

const inputCls =
  'block w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500 bg-white';
const labelCls = 'block text-xs font-medium text-gray-700 mb-1';

export default function CotizadorClient({
  userId,
  userName,
  userSucursal,
  initialQuote,
  frequentClients,
  prefill,
}: Props) {
  const router = useRouter();
  const isEdit = !!initialQuote;

  const [clientId, setClientId] = useState(initialQuote?.client_id || '');
  const [nombreTemp, setNombreTemp] = useState(
    initialQuote?.client_name_temporary || prefill?.nombre || '',
  );
  const [telTemp, setTelTemp] = useState(
    initialQuote?.client_phone_temporary || prefill?.telefono || '',
  );
  const [delivery, setDelivery] = useState(
    initialQuote?.delivery_address || prefill?.direccion || '',
  );
  const [profile, setProfile] = useState(initialQuote?.payment_profile_type || '');
  const [notes, setNotes] = useState(initialQuote?.notes || '');
  const [requiresInvoice, setRequiresInvoice] = useState(
    initialQuote ? !!initialQuote.requires_invoice : true,
  );
  const [usoCfdi, setUsoCfdi] = useState(initialQuote?.uso_cfdi || 'G03');
  const [metodoCfdi, setMetodoCfdi] = useState(initialQuote?.metodo_de_pago_cfdi || 'PPD');
  const [formaCfdi, setFormaCfdi] = useState(initialQuote?.forma_de_pago_cfdi || '99');
  const [lines, setLines] = useState<LineItem[]>(() => linesFromQuote(initialQuote));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedClient = useMemo(
    () => frequentClients.find(c => c.id === clientId) || null,
    [frequentClients, clientId],
  );

  useEffect(() => {
    if (metodoCfdi === 'PPD') setRequiresInvoice(true);
  }, [metodoCfdi]);

  const totals = useMemo(() => {
    const total = lines.reduce((sum, l) => {
      const qty = parseFloat(l.quantity) || 0;
      const price = parseFloat(l.unitPrice) || 0;
      return sum + qty * price;
    }, 0);
    const subtotal = total / (1 + IVA_RATE);
    const iva = total - subtotal;
    return {
      subtotal: parseFloat(subtotal.toFixed(3)),
      iva: parseFloat(iva.toFixed(3)),
      total: parseFloat(total.toFixed(3)),
    };
  }, [lines]);

  const lineImporte = (l: LineItem) =>
    (parseFloat(l.quantity) || 0) * (parseFloat(l.unitPrice) || 0);

  const canSave =
    !saving &&
    totals.subtotal > 0 &&
    lines.every(
      l =>
        !(l.description.trim() || l.quantity || l.unit || l.unitPrice) ||
        ((parseFloat(l.quantity) || 0) > 0 &&
          (parseFloat(l.unitPrice) || 0) >= 0 &&
          !!l.description.trim() &&
          !!l.unit.trim()),
    ) &&
    lines.some(l => (parseFloat(l.quantity) || 0) > 0 && l.description.trim() && l.unit.trim());

  const selectClient = (id: string) => {
    setClientId(id);
    if (!id) return;
    const c = frequentClients.find(x => x.id === id);
    if (!c) return;
    setNombreTemp(c.full_name);
    setTelTemp(c.phone_number || '');
    setDelivery(c.address || '');
  };

  const updateLine = (key: string, field: keyof LineItem, value: string) => {
    setLines(prev => prev.map(l => (l.key === key ? { ...l, [field]: value } : l)));
  };

  const pickProduct = (key: string, description: string) => {
    const p = products.find(x => x.description === description);
    setLines(prev =>
      prev.map(l =>
        l.key === key ? { ...l, description, unit: p?.unit || l.unit } : l,
      ),
    );
  };

  const save = async (status: QuoteStatus) => {
    setSaving(true);
    setError(null);
    try {
      const valid = lines
        .map(l => ({
          description: l.description.trim(),
          quantity: parseFloat(l.quantity) || 0,
          unit: l.unit.trim(),
          unit_price: parseFloat(l.unitPrice) || 0,
          subtotal_item: parseFloat(lineImporte(l).toFixed(3)),
        }))
        .filter(i => i.quantity > 0 && i.description && i.unit);

      if (!valid.length) throw new Error('Agrega al menos un concepto válido');
      if (!clientId && !nombreTemp.trim()) {
        throw new Error('Indica el nombre del cliente');
      }
      if (!delivery.trim()) throw new Error('La dirección de entrega es obligatoria');
      if (!profile) throw new Error('Selecciona la razón social / perfil de pago');

      const needsInvoice = requiresInvoice || metodoCfdi === 'PPD';
      const payload = {
        client_id: clientId || null,
        client_name_temporary: clientId ? null : nombreTemp.trim() || null,
        client_phone_temporary: clientId ? null : telTemp.trim() || null,
        delivery_address: delivery.trim(),
        payment_profile_type: profile,
        seller_id: userId,
        subtotal: totals.subtotal,
        iva_amount: totals.iva,
        total_amount: totals.total,
        status,
        notes: notes.trim() || null,
        requires_invoice: needsInvoice,
        uso_cfdi: needsInvoice ? usoCfdi : null,
        metodo_de_pago_cfdi: needsInvoice ? metodoCfdi : null,
        forma_de_pago_cfdi: needsInvoice ? formaCfdi : null,
      };

      const supabase = createClient();
      let saved: Quote;
      if (isEdit && initialQuote) {
        saved = await updateQuote(supabase, initialQuote.id, payload, valid);
      } else {
        saved = await saveQuote(
          supabase,
          { ...payload, created_by_staff_id: userId },
          valid,
        );
      }

      try {
        await generateQuotePDF(
          { ...saved, items: saved.items || valid },
          userName,
          userSucursal || 'tecamac',
        );
      } catch {
        // PDF opcional
      }

      router.push('/dashboard/cotizaciones');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        void save('enviada');
      }}
      className="p-3 bg-white rounded-lg shadow border border-gray-200"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Columna izquierda */}
        <div className="space-y-3">
          <fieldset className="p-3 border border-gray-300 rounded-md">
            <legend className="px-2 text-xs font-medium text-gray-700">Seleccionar Cliente</legend>
            <select
              value={clientId}
              onChange={e => selectClient(e.target.value)}
              disabled={saving}
              className={inputCls}
            >
              <option value="">-- Cliente Potencial / Mostrador --</option>
              {frequentClients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </fieldset>

          {!selectedClient ? (
            <fieldset className="p-3 border border-gray-300 rounded-md">
              <legend className="px-2 text-xs font-medium text-gray-700">
                Datos del Cliente{' '}
                <span className="text-gray-500">(Si no está registrado)</span>
              </legend>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className={labelCls}>
                    Nombre del Cliente <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={nombreTemp}
                    onChange={e => setNombreTemp(e.target.value)}
                    className={inputCls}
                    disabled={saving}
                    required={!selectedClient}
                  />
                </div>
                <div>
                  <label className={labelCls}>Teléfono (Opcional)</label>
                  <input
                    type="tel"
                    value={telTemp}
                    onChange={e => setTelTemp(e.target.value)}
                    className={inputCls}
                    disabled={saving}
                  />
                </div>
              </div>
            </fieldset>
          ) : (
            <div className="p-2 border border-blue-200 rounded-md bg-blue-50">
              <p className="text-xs font-medium text-blue-700">
                Cliente: <strong>{selectedClient.full_name}</strong>
                {selectedClient.phone_number && (
                  <span className="ml-2 text-blue-600">Tel: {selectedClient.phone_number}</span>
                )}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <fieldset className="p-3 border border-gray-300 rounded-md">
              <legend className="px-2 text-xs font-medium text-gray-700">Datos de Entrega</legend>
              <label className={labelCls}>
                Dirección <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={2}
                value={delivery}
                onChange={e => setDelivery(e.target.value)}
                required
                placeholder="Calle, Número, Colonia, C.P., Ciudad, Estado..."
                className={inputCls}
                disabled={saving}
              />
            </fieldset>

            <fieldset className="p-3 border border-gray-300 rounded-md">
              <legend className="px-2 text-xs font-medium text-gray-700">Datos para Pago</legend>
              <label className={labelCls}>
                Razón Social <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={profile}
                onChange={e => setProfile(e.target.value)}
                disabled={saving}
                className={inputCls}
              >
                <option value="" disabled>
                  -- Seleccione --
                </option>
                {PAYMENT_PROFILES.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.nombreDisplay}
                  </option>
                ))}
              </select>
            </fieldset>
          </div>
        </div>

        {/* Columna derecha */}
        <div className="space-y-3">
          <fieldset className="p-3 border border-gray-300 rounded-md">
            <legend className="px-2 text-xs font-medium text-gray-700">
              Conceptos de la Cotización
            </legend>
            <div className="mt-2">
              <div className="hidden grid-cols-12 gap-2 px-2 py-1 text-xs font-semibold text-gray-500 uppercase md:grid">
                <span className="col-span-2">Cant.</span>
                <span className="col-span-1">Unid.</span>
                <span className="col-span-5">Descripción</span>
                <span className="col-span-2 text-right">P. Unit.</span>
                <span className="col-span-1 text-right">Importe</span>
                <span className="col-span-1" />
              </div>
              <div
                className={`space-y-2 pr-1 ${
                  lines.length > 2 ? 'md:max-h-[200px] md:overflow-y-auto' : ''
                }`}
              >
                {lines.map(line => (
                  <div
                    key={line.key}
                    className="grid grid-cols-12 gap-1.5 p-1.5 border rounded-md md:items-center bg-gray-50"
                  >
                    <div className="col-span-6 md:col-span-2">
                      <label className="text-xs md:hidden">Cant.</label>
                      <input
                        type="number"
                        placeholder="0"
                        min="0.01"
                        step="any"
                        required
                        value={line.quantity}
                        onChange={e => updateLine(line.key, 'quantity', e.target.value)}
                        className="block w-full px-2 py-1 text-xs border border-gray-300 rounded-md"
                        disabled={saving}
                      />
                    </div>
                    <div className="col-span-6 md:col-span-1">
                      <label className="text-xs md:hidden">Unid.</label>
                      <input
                        type="text"
                        placeholder="Pza/Kg"
                        required
                        value={line.unit}
                        onChange={e => updateLine(line.key, 'unit', e.target.value)}
                        className="block w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                        disabled={saving}
                      />
                    </div>
                    <div className="col-span-12 md:col-span-5">
                      <label className="text-xs md:hidden">Desc.</label>
                      <input
                        type="text"
                        list="products-list"
                        placeholder="Escribe o selecciona un producto"
                        required
                        value={line.description}
                        onChange={e => {
                          pickProduct(line.key, e.target.value);
                          updateLine(line.key, 'description', e.target.value);
                        }}
                        className="block w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                        disabled={saving}
                      />
                    </div>
                    <div className="col-span-6 md:col-span-2">
                      <label className="text-xs md:hidden">P. Unit.</label>
                      <input
                        type="number"
                        placeholder="0.00"
                        min="0"
                        step="any"
                        required
                        value={line.unitPrice}
                        onChange={e => updateLine(line.key, 'unitPrice', e.target.value)}
                        className="block w-full px-2 py-1 text-sm text-right border border-gray-300 rounded-md"
                        disabled={saving}
                      />
                    </div>
                    <div className="flex items-center col-span-6 text-sm font-medium text-right md:col-span-1">
                      <span className="mr-1 md:hidden">Importe:</span>
                      {formatMoney(lineImporte(line))}
                    </div>
                    <div className="flex items-center justify-end col-span-12 md:col-span-1">
                      {lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setLines(prev => prev.filter(l => l.key !== line.key))
                          }
                          className="p-1 text-red-600 rounded-full hover:bg-red-100"
                          title="Eliminar fila"
                          disabled={saving}
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <datalist id="products-list">
                {products.map(p => (
                  <option key={p.description} value={p.description} />
                ))}
              </datalist>
              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setLines(prev => [...prev, newLine()])}
                  className="flex items-center px-2 py-1 text-xs font-medium text-white bg-rose-800 rounded hover:bg-rose-900"
                  disabled={saving}
                >
                  <PlusIcon className="w-3 h-3 mr-1" /> Agregar Concepto
                </button>
              </div>
            </div>
          </fieldset>

          <fieldset className="p-3 border border-gray-300 rounded-md">
            <legend className="px-2 text-xs font-medium text-gray-700">Facturación</legend>
            <div className="space-y-2">
              <div className="relative flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="requires_invoice"
                    type="checkbox"
                    checked={requiresInvoice}
                    onChange={e => setRequiresInvoice(e.target.checked)}
                    disabled={saving || metodoCfdi === 'PPD'}
                    className="w-4 h-4 text-rose-800 border-gray-300 rounded focus:ring-rose-500"
                  />
                </div>
                <div className="ml-2 text-xs">
                  <label htmlFor="requires_invoice" className="font-medium text-gray-700">
                    ¿Requiere Factura?
                  </label>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Marca esta casilla solo si el cliente necesita factura
                    {metodoCfdi === 'PPD' ? ' (obligatorio con PPD)' : ''}
                  </p>
                </div>
              </div>

              {requiresInvoice && (
                <div className="grid grid-cols-1 gap-2 pt-2 border-t md:grid-cols-3">
                  <div>
                    <label className={labelCls}>Método de Pago</label>
                    <select
                      value={metodoCfdi}
                      onChange={e => setMetodoCfdi(e.target.value)}
                      disabled={saving}
                      className="block w-full px-2 py-1.5 text-xs bg-white border border-gray-300 rounded-md"
                    >
                      <option value="PPD">PPD (Parcialidades)</option>
                      <option value="PUE">PUE (Una Exhibición)</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Forma de Pago</label>
                    <select
                      value={formaCfdi}
                      onChange={e => setFormaCfdi(e.target.value)}
                      disabled={saving}
                      className="block w-full px-2 py-1.5 text-xs bg-white border border-gray-300 rounded-md"
                    >
                      <option value="01">01 - Efectivo</option>
                      <option value="02">02 - Cheque</option>
                      <option value="03">03 - Transferencia</option>
                      <option value="04">04 - T. Crédito</option>
                      <option value="28">28 - T. Débito</option>
                      <option value="99">99 - Por definir</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Uso del CFDI</label>
                    <select
                      value={usoCfdi}
                      onChange={e => setUsoCfdi(e.target.value)}
                      disabled={saving}
                      className="block w-full px-2 py-1.5 text-xs bg-white border border-gray-300 rounded-md"
                    >
                      <option value="G01">G01 - Adq. mercancías</option>
                      <option value="G03">G03 - Gastos generales</option>
                      <option value="I01">I01 - Construcción</option>
                      <option value="I04">I04 - Equipo cómputo</option>
                      <option value="P01">P01 - Por definir</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </fieldset>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        <div>
          <label className={labelCls}>Notas Adicionales (Opcional)</label>
          <textarea
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            disabled={saving}
            className="block w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md"
            placeholder="Condiciones especiales, tiempo de entrega, etc."
          />
        </div>

        <div className="grid grid-cols-3 gap-3 p-3 border border-dashed border-gray-400 rounded-md bg-gray-50">
          <div className="text-center">
            <p className="text-[10px] text-gray-600 uppercase">Subtotal</p>
            <p className="text-sm font-semibold text-gray-800">{formatMoney(totals.subtotal)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-gray-600 uppercase">IVA ({(IVA_RATE * 100).toFixed(0)}%)</p>
            <p className="text-sm font-semibold text-gray-800">{formatMoney(totals.iva)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-gray-600 uppercase font-bold">Total</p>
            <p className="text-base font-bold text-rose-800">{formatMoney(totals.total)}</p>
          </div>
        </div>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Link
            href="/dashboard/cotizaciones"
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
          >
            Cancelar
          </Link>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => void save('enviada')}
            className={`inline-flex items-center px-3 py-1.5 text-xs font-medium text-white rounded-md shadow-sm ${
              !canSave ? 'bg-rose-300 cursor-not-allowed' : 'bg-rose-800 hover:bg-rose-900'
            }`}
          >
            {saving ? 'Guardando...' : isEdit ? 'Actualizar Cotización' : 'Guardar Cotización'}
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => void save('aceptada')}
            className={`inline-flex items-center px-3 py-1.5 text-xs font-medium text-white rounded-md shadow-sm ${
              !canSave ? 'bg-sky-300 cursor-not-allowed' : 'bg-sky-600 hover:bg-sky-700'
            }`}
          >
            Guardar como aceptada
          </button>
        </div>
      </div>
    </form>
  );
}
