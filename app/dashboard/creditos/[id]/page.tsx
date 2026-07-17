import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import DetalleCreditoClient from './DetalleCreditoClient';

export default async function DetalleCreditoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/dashboard/creditos" className="text-sm text-emerald-700 hover:underline">
          ← Volver a créditos
        </Link>
        <h1 className="text-2xl font-bold text-slate-800 mt-2">Detalle de crédito</h1>
      </div>
      <DetalleCreditoClient creditId={id} userId={user.id} />
    </div>
  );
}
