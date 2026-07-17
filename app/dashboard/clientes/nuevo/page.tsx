import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import NuevoClienteClient from './NuevoClienteClient';

export default async function NuevoClientePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="p-6 mx-auto max-w-2xl">
      <div className="pb-4 mb-6 border-b border-slate-200">
        <h1 className="text-2xl font-bold text-slate-800">Agregar Nuevo Cliente</h1>
        <p className="mt-1 text-sm text-slate-600">
          Completa la información del cliente para registrarlo en el sistema
        </p>
      </div>
      <NuevoClienteClient userId={user.id} />
    </div>
  );
}
