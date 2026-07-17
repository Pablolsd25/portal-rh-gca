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

  return <CajaMostradorClient userId={user.id} sucursal={staff?.sucursal ?? null} />;
}
