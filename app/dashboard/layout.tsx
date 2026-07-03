import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/Sidebar';
import { tieneAccesoPortal } from '@/lib/auth';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: staffUser } = await supabase
    .from('staff_users')
    .select('full_name, role, is_active')
    .eq('id', user.id)
    .single();

  if (!staffUser || !staffUser.is_active || !tieneAccesoPortal(staffUser.role)) {
    redirect('/login');
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar userName={staffUser.full_name} userRole={staffUser.role} />
      <main className="flex-1 overflow-y-auto bg-gray-50">
        {children}
      </main>
    </div>
  );
}
