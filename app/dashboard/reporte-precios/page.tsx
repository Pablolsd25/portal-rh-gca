import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ReportePreciosClient from './ReportePreciosClient';

export default async function ReportePreciosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: staff } = await supabase
    .from('staff_users')
    .select('id, role')
    .eq('id', user.id)
    .single();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Reporte de precios</h1>
        <p className="text-sm text-slate-600 mt-1">
          Precios de competencia / clientes · tabla price_reports
        </p>
      </div>
      <ReportePreciosClient userId={user.id} role={staff?.role ?? ''} />
    </div>
  );
}
