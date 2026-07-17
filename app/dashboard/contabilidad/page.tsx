import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ContabilidadClient from './ContabilidadClient';

export default async function ContabilidadPage() {
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

  if (!staff) redirect('/dashboard');

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Contabilidad PPD</h1>
        <p className="text-sm text-slate-600 mt-1">
          Ventas concretadas con método PPD o factura pendiente de complemento
        </p>
      </div>
      <ContabilidadClient
        userId={user.id}
        userName={staff.full_name}
        userSucursal={staff.sucursal ?? null}
      />
    </div>
  );
}
