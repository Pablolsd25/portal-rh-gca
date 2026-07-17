import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AdminReportePreciosClient from './AdminReportePreciosClient';

export default async function AdminReportePreciosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Análisis de precios</h1>
        <p className="text-sm text-slate-600 mt-1">
          Estadísticas y tendencias de reportes de precios del mercado
        </p>
      </div>
      <AdminReportePreciosClient />
    </div>
  );
}
