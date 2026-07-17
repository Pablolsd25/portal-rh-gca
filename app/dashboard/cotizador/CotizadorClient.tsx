'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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

  const [clientId, setClientId] = useState('');
  const [nombreTemp, setNombreTemp] = useState(
    initialQuote?.client_name_temporary || prefill?.nombre || '',
  );
  const [telTemp, setTelTemp] = useState(
    initialQuote?.client_phone_temporary || prefill?.telefono || '',
  );
  const [delivery, setDelivery] = useState(
    initialQuote?.delivery_address || prefill?.direccion || '',
  )
  const [profile, setProfile] = useState(initialQuote?.payment_profile_type || 'ADRIAN_CASTRO');
  const [notes, setNotes] = useState(initialQuote?.notes || '');
  const [requiresInvoice, setRequiresInvoice] = useState(!!initialQuote?.requires_invoice);
  const [usoCfdi, setUsoCfdi] = useState(initialQuote?.uso_cfdi || 'G03');
  const [metodoCfdi, setMetodoCfdi] = useState(initialQuote?.metodo_de_pago_cfdi || 'PPD');
  const [formaCfdi, setFormaCfdi] = useState(initialQuote?.forma_de_pago_cfdi || '99');
  const [lines, setLines] = useState<LineItem[]>(() => linesFromQuote(initialQuote));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

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
        l.key === key
          ? { ...l, description, unit: p?.unit || l.unit }
          : l,
      ),
    );
  };

  const save = async (status: QuoteStatus) => {
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const valid = lines
        .map(l => ({
          description: l.description.trim(),
          quantity: parseFloat(l.quantity) || 0,
          unit: l.unit.trim(),
          unit_price: parseFloat(l.unitPrice) || 0,
          subtotal_item: parseFloat(
            (((parseFloat(l.quantity) || 0) * (parseFloat(l.unitPrice) || 0)).toFixed(3)),
          ),
        }))
        .filter(i => i.quantity > 0 && i.description && i.unit);

      if (!valid.length) throw new Error('Agrega al menos un concepto válido');
      if (!nombreTemp.trim() && !clientId) throw new Error('Indica el nombre del cliente');
      if (!profile) throw new Error('Selecciona perfil de pago');

      const payload = {
        client_id: null as string | null,
        client_name_temporary: nombreTemp.trim() || null,
        client_phone_temporary: telTemp.trim() || null,
        delivery_address: delivery.trim() || null,
        payment_profile_type: profile,
        seller_id: userId,
        subtotal: totals.subtotal,
        iva_amount: totals.iva,
        total_amount: totals.total,
        status,
        notes: notes.trim() || null,
        requires_invoice: requiresInvoice || metodoCfdi === 'PPD',
        uso_cfdi: requiresInvoice || metodoCfdi === 'PPD' ? usoCfdi : null,
        metodo_de_pago_cfdi: requiresInvoice || metodoCfdi === 'PPD' ? metodoCfdi : null,
        forma_de_pago_cfdi: requiresInvoice || metodoCfdi === 'PPD' ? formaCfdi : null,
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
        // PDF opcional si falla
      }

      setOk(`Cotización ${isEdit ? 'actualizada' : 'guardada'} como ${status}`);
      router.push('/dashboard/cotizaciones');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>
      )}
      {ok && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-700">{ok}</div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Cliente frecuente</label>
            <select
              value={clientId}
              onChange={e => selectClient(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
            >
              <option value="">— Cliente temporal / mostrador —</option>
              {frequentClients.map(c => (
                <option key={c.id} value={c.id}>{c.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Perfil de pago</label>
            <select
              value={profile}
              onChange={e => setProfile(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
            >
              <option value="ADRIAN_CASTRO">Adrian Castro Salazar</option>
              <option value="SIGLO_XXI">Aceros y Materiales Siglo XXI</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nombre cliente</label>
            <input
              value={nombreTemp}
              onChange={e => setNombreTemp(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              placeholder="Nombre"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Teléfono</label>
            <input
              value={telTemp}
              onChange={e => setTelTemp(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              placeholder="Teléfono"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Dirección de entrega</label>
            <input
              value={delivery}
              onChange={e => setDelivery(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              placeholder="Calle, colonia, municipio..."
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Notas</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
            />
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <label className="flex items-center gap-2 text-sm text-slate-700 mb-3">
            <input
              type="checkbox"
              checked={requiresInvoice || metodoCfdi === 'PPD'}
              onChange={e => setRequiresInvoice(e.target.checked)}
            />
            Requiere factura
          </label>
          {(requiresInvoice || metodoCfdi === 'PPD') && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Uso CFDI</label>
                <input value={usoCfdi} onChange={e => setUsoCfdi(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Método CFDI</label>
                <select value={metodoCfdi} onChange={e => setMetodoCfdi(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg">
                  <option value="PPD">PPD</option>
                  <option value="PUE">PUE</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Forma CFDI</label>
                <input value={formaCfdi} onChange={e => setFormaCfdi(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700">Conceptos</h2>
          <button
            type="button"
            onClick={() => setLines(prev => [...prev, newLine()])}
            className="text-xs text-emerald-700 hover:underline"
          >
            + Agregar renglón
          </button>
        </div>
        <div className="space-y-3">
          {lines.map(line => (
            <div key={line.key} className="grid grid-cols-12 gap-2 items-start">
              <div className="col-span-12 sm:col-span-5">
                <input
                  list={`products-${line.key}`}
                  value={line.description}
                  onChange={e => {
                    updateLine(line.key, 'description', e.target.value);
                    pickProduct(line.key, e.target.value);
                  }}
                  placeholder="Descripción"
                  className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
                />
                <datalist id={`products-${line.key}`}>
                  {products.map(p => (
                    <option key={p.description} value={p.description} />
                  ))}
                </datalist>
              </div>
              <div className="col-span-4 sm:col-span-2">
                <input
                  type="number"
                  step="any"
                  value={line.quantity}
                  onChange={e => updateLine(line.key, 'quantity', e.target.value)}
                  placeholder="Cant."
                  className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div className="col-span-4 sm:col-span-1">
                <input
                  value={line.unit}
                  onChange={e => updateLine(line.key, 'unit', e.target.value)}
                  placeholder="Unid."
                  className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <input
                  type="number"
                  step="any"
                  value={line.unitPrice}
                  onChange={e => updateLine(line.key, 'unitPrice', e.target.value)}
                  placeholder="P. unit."
                  className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div className="col-span-8 sm:col-span-1 flex items-center text-xs text-slate-600 py-1.5">
                {formatMoney((parseFloat(line.quantity) || 0) * (parseFloat(line.unitPrice) || 0))}
              </div>
              <div className="col-span-4 sm:col-span-1">
                <button
                  type="button"
                  onClick={() => setLines(prev => (prev.length > 1 ? prev.filter(l => l.key !== line.key) : [newLine()]))}
                  className="text-xs text-red-600 hover:underline py-1.5"
                >
                  Quitar
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 border-t border-slate-100 pt-4 flex flex-col items-end gap-1 text-sm">
          <p className="text-slate-600">Subtotal: <span className="font-medium text-slate-800">{formatMoney(totals.subtotal)}</span></p>
          <p className="text-slate-600">IVA 16%: <span className="font-medium text-slate-800">{formatMoney(totals.iva)}</span></p>
          <p className="text-base font-bold text-slate-800">Total: {formatMoney(totals.total)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 justify-end">
        <Link href="/dashboard/cotizaciones" className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">
          Cancelar
        </Link>
        <button
          type="button"
          disabled={saving}
          onClick={() => save('enviada')}
          className="px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar como enviada'}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => save('aceptada')}
          className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar como aceptada'}
        </button>
      </div>
    </div>
  );
}
