import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DetalleClienteClient from './DetalleClienteClient';

type Props = { params: Promise<{ id: string }> };

export default async function DetalleClientePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="p-6 mx-auto max-w-4xl">
      <DetalleClienteClient clientId={id} />
    </div>
  );
}
