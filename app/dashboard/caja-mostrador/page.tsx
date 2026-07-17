import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import CajaMostradorClient from './CajaMostradorClient';

export default async function CajaMostradorPage() {
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
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Caja mostrador</h1>
        <p className="text-sm text-slate-600 mt-1">
          Sesión de caja, movimientos y retiros
          {staff?.sucursal ? ` · ${staff.sucursal}` : ''}
        </p>
      </div>
      <CajaMostradorClient userId={user.id} sucursal={staff?.sucursal ?? null} />
    </div>
  );
}
