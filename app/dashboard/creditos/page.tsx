import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import CreditosClient from './CreditosClient';

export default async function CreditosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Créditos</h1>
        <p className="text-sm text-slate-600 mt-1">
          Solicitudes, activos, aprobación y seguimiento de abonos
        </p>
      </div>
      <CreditosClient userId={user.id} />
    </div>
  );
}
