import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ReporteVentasClient from './ReporteVentasClient';

export default async function ReporteVentasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: staff } = await supabase
    .from('staff_users')
    .select('full_name, sucursal')
    .eq('id', user.id)
    .single();

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-800">Reporte de ventas</h1>
        <p className="text-sm text-slate-600 mt-1">
          KPIs, gráficas por vendedor y filtros por período (manual / mensual / semanal)
        </p>
      </div>
      <ReporteVentasClient
        userName={staff?.full_name || user.email || 'Usuario'}
        userSucursal={staff?.sucursal ?? null}
      />
    </div>
  );
}
