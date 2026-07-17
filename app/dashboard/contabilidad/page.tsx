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
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <div className="pb-3 mb-4 border-b border-slate-200">
        <h1 className="text-xl font-bold text-slate-800">Contabilidad PPD</h1>
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
