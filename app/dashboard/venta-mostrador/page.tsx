import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import VentaMostradorClient from './VentaMostradorClient';

export default async function VentaMostradorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: staff } = await supabase
    .from('staff_users')
    .select('id, full_name, role, sucursal')
    .eq('id', user.id)
    .single();

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Venta mostrador</h1>
        <p className="text-sm text-slate-600 mt-1">
          Cobros pendientes y venta rápida
          {staff?.sucursal ? ` · ${staff.sucursal}` : ''}
        </p>
      </div>
      <VentaMostradorClient
        userId={user.id}
        userName={staff?.full_name ?? 'Mostrador'}
        sucursal={staff?.sucursal ?? null}
        role={staff?.role ?? ''}
      />
    </div>
  );
}
