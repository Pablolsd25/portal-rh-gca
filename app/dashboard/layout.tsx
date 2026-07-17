import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/Sidebar';
import { tieneAccesoPortal } from '@/lib/auth';
import { NotificationProvider } from '@/components/notifications/NotificationContext';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: staffUser } = await supabase
    .from('staff_users')
    .select('full_name, role, is_active, email')
    .eq('id', user.id)
    .single();

  if (!staffUser || !staffUser.is_active || !tieneAccesoPortal(staffUser.role)) {
    redirect('/login');
  }

  return (
    <NotificationProvider>
      <div className="min-h-screen bg-gray-50 flex">
        <Sidebar
          userName={staffUser.full_name}
          userRole={staffUser.role}
          userEmail={staffUser.email || user.email}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <main className="flex-1 bg-gray-50">{children}</main>
        </div>
      </div>
    </NotificationProvider>
  );
}
