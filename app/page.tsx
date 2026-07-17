import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { rutaInicio, tieneAccesoPortal } from '@/lib/auth';

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: staffUser } = await supabase
    .from('staff_users')
    .select('role, is_active')
    .eq('id', user.id)
    .single();

  if (!staffUser?.is_active || !tieneAccesoPortal(staffUser.role)) {
    redirect('/login');
  }

  redirect(rutaInicio(staffUser.role));
}
