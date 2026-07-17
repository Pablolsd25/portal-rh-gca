'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import CreditoForm from '@/components/creditos/CreditoForm';
import { calcCreditTotals } from '@/lib/creditos/calc';
import { createMaterialItem } from '@/lib/creditos/constants';
import { products } from '@/lib/ventas/products';
import type { CreditType, InterestMode, MaterialItem } from '@/lib/creditos/types';

export default function EditarCreditoClient({ creditId }: { creditId: string }) {
  const router = useRouter();
  const [clientName, setClientName] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [materialItems, setMaterialItems] = useState<MaterialItem[]>([createMaterialItem()]);
  const [creditType, setCreditType] = useState<CreditType>('por_plazo');
  const [paymentTermWeeks, setPaymentTermWeeks] = useState(12);
  const [interestMode, setInterestMode] = useState<InterestMode>('auto');
  const [manualInterestRate, setManualInterestRate] = useState('');
  const [paymentTermMonths, setPaymentTermMonths] = useState(3);
  const [monthlyInterestRate, setMonthlyInterestRate] = useState('8.0');

  useEffect(() => {
    void (async () => {
      setInitialLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const { data: creditData, error: creditErr } = await supabase
          .from('credits')
          .select('*, clients(id, full_name)')
          .eq('id', creditId)
          .single();
        if (creditErr) throw creditErr;
        if (creditData.status !== 'pendiente') {
          throw new Error("Solo se pueden editar créditos con estado 'pendiente'.");
        }

        setClientName(creditData.clients?.full_name || 'Cliente');
        setCreditType((creditData.credit_type as CreditType) || 'por_plazo');

        if (creditData.credit_type === 'mensual') {
          setPaymentTermMonths(Math.max(1, Math.round((creditData.payment_term_weeks || 12) / 4)));
          setMonthlyInterestRate(String(creditData.monthly_interest_rate ?? 8));
        } else {
          setPaymentTermWeeks(creditData.payment_term_weeks || 12);
          setInterestMode('manual');
          setManualInterestRate(String(creditData.interest_rate ?? ''));
        }

        const { data: itemsData, error: itemsErr } = await supabase
          .from('credit_products')
          .select('*')
          .eq('credit_id', creditId);
        if (itemsErr) throw itemsErr;

        const mapped: MaterialItem[] =
          itemsData && itemsData.length > 0
            ? itemsData.map(item => ({
                id: crypto.randomUUID(),
                quantity: String(item.quantity ?? ''),
                unit: item.unit || '',
                description: item.description || '',
                unitPrice: String(item.unit_price ?? ''),
                subtotal: Number(item.subtotal) || 0,
              }))
            : [createMaterialItem()];
        setMaterialItems(mapped);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar');
      } finally {
        setInitialLoading(false);
      }
    })();
  }, [creditId]);

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
      }),
    [
      materialItems,
      creditType,
      paymentTermWeeks,
      interestMode,
      manualInterestRate,
      paymentTermMonths,
      monthlyInterestRate,
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
    const validItems = materialItems.filter(
      i => parseFloat(i.quantity) > 0 && i.description.trim() && i.unit.trim(),
    );
    if (validItems.length === 0) {
      setError('Agrega al menos un material válido.');
      return;
    }
    if (totals.totalDue <= 0) {
      setError('El monto total debe ser mayor a cero.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const finalWeeks =
        creditType === 'por_plazo' ? paymentTermWeeks : paymentTermMonths * 4;

      const { error: updErr } = await supabase
        .from('credits')
        .update({
          requested_amount: totals.subtotal,
          total_amount_due: totals.totalDue,
          weekly_payment_amount: totals.weeklyPayment,
          credit_type: creditType,
          interest_rate: totals.interestRatePercent,
          monthly_interest_rate:
            creditType === 'mensual' ? parseFloat(monthlyInterestRate) : null,
          payment_term_weeks: finalWeeks,
        })
        .eq('id', creditId)
        .eq('status', 'pendiente');
      if (updErr) throw updErr;

      const { error: delErr } = await supabase
        .from('credit_products')
        .delete()
        .eq('credit_id', creditId);
      if (delErr) throw delErr;

      const { error: insErr } = await supabase.from('credit_products').insert(
        validItems.map(item => ({
          credit_id: creditId,
          quantity: parseFloat(item.quantity),
          unit: item.unit.trim(),
          description: item.description.trim(),
          unit_price: parseFloat(item.unitPrice) || 0,
          subtotal: item.subtotal,
        })),
      );
      if (insErr) throw insErr;

      router.push(`/dashboard/creditos/${creditId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) return <p className="text-sm text-slate-500">Cargando…</p>;
  if (error && !clientName) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
        {error}
      </div>
    );
  }

  return (
    <CreditoForm
      clientName={clientName}
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
      submitLabel="Guardar cambios"
      onCancel={() => router.push(`/dashboard/creditos/${creditId}`)}
      onSubmit={handleSubmit}
    />
  );
}
