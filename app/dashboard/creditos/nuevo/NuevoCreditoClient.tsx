'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import CreditoForm from '@/components/creditos/CreditoForm';
import { calcCreditTotals } from '@/lib/creditos/calc';
import { createMaterialItem, PLAZO_INICIAL_SEMANAS, UPLOADABLE_DOCS } from '@/lib/creditos/constants';
import {
  deleteOrphanCredit,
  hasPendingFiles,
  uploadCreditDocuments,
} from '@/lib/creditos/docs';
import { products } from '@/lib/ventas/products';
import type { CreditProduct, CreditType, InterestMode, MaterialItem } from '@/lib/creditos/types';

type ClientOpt = { id: string; full_name: string };

export default function NuevoCreditoClient({
  userId,
  initialClientId = '',
  refinanceFromId = '',
}: {
  userId: string;
  initialClientId?: string;
  refinanceFromId?: string;
}) {
  const router = useRouter();
  const isRefinancing = Boolean(refinanceFromId);

  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [clientId, setClientId] = useState(initialClientId);
  const [clientQ, setClientQ] = useState('');
  const [loadingClients, setLoadingClients] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingRefinance, setLoadingRefinance] = useState(isRefinancing);

  const [originalBalance, setOriginalBalance] = useState(0);
  const [originalCreditProducts, setOriginalCreditProducts] = useState<CreditProduct[]>([]);
  const [originalTermWeeks, setOriginalTermWeeks] = useState(PLAZO_INICIAL_SEMANAS);

  const [materialItems, setMaterialItems] = useState<MaterialItem[]>([createMaterialItem()]);
  const [creditType, setCreditType] = useState<CreditType>('por_plazo');
  const [paymentTermWeeks, setPaymentTermWeeks] = useState(PLAZO_INICIAL_SEMANAS);
  const [interestMode, setInterestMode] = useState<InterestMode>('auto');
  const [manualInterestRate, setManualInterestRate] = useState('');
  const [paymentTermMonths, setPaymentTermMonths] = useState(3);
  const [monthlyInterestRate, setMonthlyInterestRate] = useState('8.0');
  const [pendingFiles, setPendingFiles] = useState<Record<string, File | null>>(
    Object.fromEntries(UPLOADABLE_DOCS.map(d => [d.id, null])),
  );

  useEffect(() => {
    void (async () => {
      setLoadingClients(true);
      try {
        const supabase = createClient();
        const { data, error: err } = await supabase
          .from('clients')
          .select('id, full_name')
          .order('full_name')
          .limit(500);
        if (err) throw err;
        let list = (data as ClientOpt[]) || [];
        if (initialClientId && !list.some(c => c.id === initialClientId)) {
          const { data: one } = await supabase
            .from('clients')
            .select('id, full_name')
            .eq('id', initialClientId)
            .maybeSingle();
          if (one) list = [one as ClientOpt, ...list];
        }
        setClients(list);
        if (initialClientId) setClientId(initialClientId);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar clientes');
      } finally {
        setLoadingClients(false);
      }
    })();
  }, [initialClientId]);

  useEffect(() => {
    if (!refinanceFromId) {
      setLoadingRefinance(false);
      return;
    }
    void (async () => {
      setLoadingRefinance(true);
      setError(null);
      try {
        const supabase = createClient();
        const { data: creditData, error: creditErr } = await supabase
          .from('credits')
          .select('*')
          .eq('id', refinanceFromId)
          .single();
        if (creditErr) throw creditErr;
        if (creditData.status !== 'activo') {
          throw new Error('Solo se pueden refinanciar créditos activos.');
        }

        setClientId(creditData.client_id);
        const term = creditData.payment_term_weeks || PLAZO_INICIAL_SEMANAS;
        setOriginalTermWeeks(term);
        setPaymentTermWeeks(term);

        const [productsRes, paymentsRes] = await Promise.all([
          supabase.from('credit_products').select('*').eq('credit_id', refinanceFromId),
          supabase.from('payments').select('amount_paid').eq('credit_id', refinanceFromId),
        ]);
        if (productsRes.error) throw productsRes.error;
        if (paymentsRes.error) throw paymentsRes.error;

        setOriginalCreditProducts((productsRes.data as CreditProduct[]) || []);
        const totalPaid = (paymentsRes.data || []).reduce(
          (acc, p) => acc + (Number(p.amount_paid) || 0),
          0,
        );
        const balance = (Number(creditData.total_amount_due) || 0) - totalPaid;
        setOriginalBalance(balance > 0 ? parseFloat(balance.toFixed(2)) : 0);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar crédito a refinanciar');
      } finally {
        setLoadingRefinance(false);
      }
    })();
  }, [refinanceFromId]);

  const filteredClients = useMemo(() => {
    const s = clientQ.trim().toLowerCase();
    if (!s) return clients.slice(0, 50);
    return clients.filter(c => c.full_name.toLowerCase().includes(s)).slice(0, 50);
  }, [clients, clientQ]);

  const selectedClient = clients.find(c => c.id === clientId);

  const newMaterialsSubtotal = useMemo(
    () => materialItems.reduce((sum, item) => sum + (item.subtotal || 0), 0),
    [materialItems],
  );

  const totals = useMemo(
    () =>
      calcCreditTotals({
        materialItems,
        creditType,
        paymentTermWeeks,
        interestMode,
        manualInterestRate,
        paymentTermMonths,
        monthlyInterestRate,
        originalBalance: isRefinancing ? originalBalance : 0,
      }),
    [
      materialItems,
      creditType,
      paymentTermWeeks,
      interestMode,
      manualInterestRate,
      paymentTermMonths,
      monthlyInterestRate,
      isRefinancing,
      originalBalance,
    ],
  );

  const onMaterialChange = useCallback((id: string, field: keyof MaterialItem, value: string) => {
    setMaterialItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const next = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          const q = parseFloat(next.quantity) || 0;
          const p = parseFloat(next.unitPrice) || 0;
          next.subtotal = parseFloat((q * p).toFixed(2));
        }
        return next;
      }),
    );
  }, []);

  const onProductSelect = useCallback((id: string, description: string) => {
    const product = products.find(p => p.description === description);
    if (!product) return;
    setMaterialItems(prev =>
      prev.map(item =>
        item.id === id
          ? { ...item, description: product.description, unit: product.unit }
          : item,
      ),
    );
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      setError('Selecciona un cliente.');
      return;
    }
    const validItems = materialItems.filter(
      i => parseFloat(i.quantity) > 0 && i.description.trim() && i.unit.trim(),
    );
    if (validItems.length === 0 && !isRefinancing) {
      setError('Agrega al menos un material válido.');
      return;
    }
    if (totals.totalDue <= 0) {
      setError('El monto total debe ser mayor a cero.');
      return;
    }

    setLoading(true);
    setError(null);
    let createdCreditId: string | null = null;
    try {
      const supabase = createClient();
      const finalWeeks =
        creditType === 'por_plazo' ? paymentTermWeeks : paymentTermMonths * 4;

      const baseInsert: Record<string, unknown> = {
        client_id: clientId,
        initiated_by_staff_id: userId,
        status: 'pendiente',
        requested_amount: totals.subtotal,
        total_amount_due: totals.totalDue,
        weekly_payment_amount: totals.weeklyPayment,
        credit_type: creditType,
        interest_rate: totals.interestRatePercent,
        monthly_interest_rate:
          creditType === 'mensual' ? parseFloat(monthlyInterestRate) : null,
        payment_term_weeks: finalWeeks,
      };

      let newCredit: { id: string } | null = null;
      if (isRefinancing && refinanceFromId) {
        const withRef = { ...baseInsert, refinanced_from_credit_id: refinanceFromId };
        const { data, error: creditError } = await supabase
          .from('credits')
          .insert(withRef)
          .select('id')
          .single();
        if (creditError) {
          // Column may not exist yet — retry without it.
          const msg = creditError.message?.toLowerCase() || '';
          if (
            msg.includes('refinanced_from_credit_id') ||
            msg.includes('column') ||
            creditError.code === 'PGRST204' ||
            creditError.code === '42703'
          ) {
            const { data: fallback, error: fallbackErr } = await supabase
              .from('credits')
              .insert(baseInsert)
              .select('id')
              .single();
            if (fallbackErr) throw fallbackErr;
            newCredit = fallback;
          } else {
            throw creditError;
          }
        } else {
          newCredit = data;
        }
      } else {
        const { data, error: creditError } = await supabase
          .from('credits')
          .insert(baseInsert)
          .select('id')
          .single();
        if (creditError) throw creditError;
        newCredit = data;
      }

      const creditId = newCredit!.id as string;
      createdCreditId = creditId;

      const productsInsert = validItems.map(item => ({
        credit_id: creditId,
        quantity: parseFloat(item.quantity),
        unit: item.unit.trim(),
        description: item.description.trim(),
        unit_price: parseFloat(item.unitPrice) || 0,
        subtotal: item.subtotal,
      }));

      if (isRefinancing && originalBalance > 0) {
        productsInsert.unshift({
          credit_id: creditId,
          quantity: 1,
          unit: 'saldo',
          description: `Saldo pendiente de crédito anterior #${refinanceFromId}`,
          unit_price: originalBalance,
          subtotal: originalBalance,
        });
      }

      if (productsInsert.length > 0) {
        const { error: prodErr } = await supabase.from('credit_products').insert(productsInsert);
        if (prodErr) throw prodErr;
      }

      if (hasPendingFiles(pendingFiles)) {
        const docErrors = await uploadCreditDocuments(supabase, {
          clientId,
          creditId,
          staffId: userId,
          files: pendingFiles,
        });
        if (docErrors.length > 0) {
          await deleteOrphanCredit(supabase, creditId);
          createdCreditId = null;
          throw new Error(
            `No se pudo subir documentos; el crédito no se guardó. ${docErrors.join('; ')}`,
          );
        }
      }

      if (isRefinancing && refinanceFromId) {
        const { error: updErr } = await supabase
          .from('credits')
          .update({ status: 'refinanciado' })
          .eq('id', refinanceFromId);
        if (updErr) {
          console.warn('No se pudo marcar crédito original como refinanciado:', updErr.message);
        }
      }

      router.push(`/dashboard/creditos/${creditId}`);
    } catch (err) {
      if (createdCreditId) {
        try {
          await deleteOrphanCredit(createClient(), createdCreditId);
        } catch {
          /* best-effort cleanup */
        }
      }
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  if (loadingRefinance) {
    return <p className="text-sm text-slate-500">Cargando datos de refinanciamiento…</p>;
  }

  return (
    <div className="space-y-4">
      {isRefinancing && originalCreditProducts.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-2">
            Materiales del crédito original
          </h3>
          <ul className="text-sm text-slate-600 space-y-1 max-h-40 overflow-y-auto">
            {originalCreditProducts.map(p => (
              <li key={p.id}>
                {p.quantity} {p.unit} · {p.description}
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-400 mt-2">Plazo sugerido: {originalTermWeeks} semanas</p>
        </div>
      )}

      {!isRefinancing && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <label className="block text-sm font-medium text-slate-700">Cliente *</label>
          <input
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full sm:w-80"
            placeholder="Buscar cliente…"
            value={clientQ}
            onChange={e => setClientQ(e.target.value)}
            disabled={loadingClients}
          />
          <select
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full sm:w-96 bg-white"
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            disabled={loadingClients || loading}
            required
          >
            <option value="">— Seleccionar —</option>
            {filteredClients.map(c => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
            {clientId && !filteredClients.some(c => c.id === clientId) && (
              <option value={clientId}>
                {selectedClient?.full_name || 'Cliente preseleccionado'}
              </option>
            )}
          </select>
          {selectedClient && (
            <p className="text-xs text-slate-500">Seleccionado: {selectedClient.full_name}</p>
          )}
        </div>
      )}

      {isRefinancing && selectedClient && (
        <p className="text-sm text-slate-600">
          Cliente: <strong>{selectedClient.full_name}</strong>
        </p>
      )}

      {clientId ? (
        <CreditoForm
          clientName={selectedClient?.full_name || 'Cliente'}
          loading={loading}
          error={error}
          materialItems={materialItems}
          onMaterialChange={onMaterialChange}
          onAddMaterial={() => setMaterialItems(prev => [...prev, createMaterialItem()])}
          onRemoveMaterial={id =>
            setMaterialItems(prev => (prev.length > 1 ? prev.filter(i => i.id !== id) : prev))
          }
          onProductSelect={onProductSelect}
          creditType={creditType}
          onCreditTypeChange={setCreditType}
          paymentTermWeeks={paymentTermWeeks}
          onTermChange={setPaymentTermWeeks}
          interestMode={interestMode}
          onInterestModeChange={m => {
            setInterestMode(m);
            if (m === 'auto') setManualInterestRate('');
          }}
          manualInterestRate={manualInterestRate}
          onManualInterestRateChange={setManualInterestRate}
          paymentTermMonths={paymentTermMonths}
          onPaymentTermMonthsChange={setPaymentTermMonths}
          monthlyInterestRate={monthlyInterestRate}
          onMonthlyInterestRateChange={setMonthlyInterestRate}
          totals={totals}
          pendingFiles={pendingFiles}
          onFileSelect={(docType, file) =>
            setPendingFiles(prev => ({ ...prev, [docType]: file }))
          }
          onCancel={() =>
            router.push(
              isRefinancing
                ? `/dashboard/creditos/${refinanceFromId}`
                : '/dashboard/creditos',
            )
          }
          onSubmit={handleSubmit}
          isRefinancing={isRefinancing}
          originalBalance={originalBalance}
          originalCreditId={refinanceFromId || null}
          newMaterialsSubtotal={newMaterialsSubtotal}
          submitLabel={isRefinancing ? 'Guardar refinanciamiento' : 'Guardar solicitud'}
        />
      ) : (
        error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )
      )}
    </div>
  );
}
