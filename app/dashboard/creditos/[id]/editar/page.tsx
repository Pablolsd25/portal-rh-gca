import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import EditarCreditoClient from './EditarCreditoClient';

export default async function EditarCreditoPage({
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
        <Link
          href={`/dashboard/creditos/${id}`}
          className="text-sm text-rose-700 hover:underline"
        >
          ← Volver al detalle
        </Link>
        <h1 className="text-2xl font-bold text-slate-800 mt-2">Editar crédito</h1>
        <p className="text-sm text-slate-600 mt-1">Solo créditos pendientes</p>
      </div>
      <EditarCreditoClient creditId={id} />
    </div>
  );
}
