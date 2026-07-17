import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ProspectosClient from './ProspectosClient';

export default async function ProspectosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Prospectos</h1>
        <p className="text-sm text-slate-600 mt-1">Alta y seguimiento de prospectos comerciales</p>
      </div>
      <ProspectosClient userId={user.id} />
    </div>
  );
}
