import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import EditarClienteClient from './EditarClienteClient';

type Props = { params: Promise<{ id: string }> };

export default async function EditarClientePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="p-6 mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-slate-800">Editar Cliente</h1>
      <EditarClienteClient clientId={id} />
    </div>
  );
}
