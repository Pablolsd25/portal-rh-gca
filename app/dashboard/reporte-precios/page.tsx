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
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Reporte de precios</h1>
        <p className="text-sm text-slate-600 mt-1">
          Un comercio, varios materiales · precios unificados por tonelada (TON)
        </p>
      </div>
      <ReportePreciosClient userId={user.id} role={staff?.role ?? ''} />
    </div>
  );
}
