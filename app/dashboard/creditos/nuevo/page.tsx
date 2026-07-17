import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import NuevoCreditoClient from './NuevoCreditoClient';

type Props = {
  searchParams: Promise<{ clientId?: string; refinanceFrom?: string }>;
};

export default async function NuevoCreditoPage({ searchParams }: Props) {
  const { clientId, refinanceFrom } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const isRefinancing = Boolean(refinanceFrom);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          href={
            isRefinancing
              ? `/dashboard/creditos/${refinanceFrom}`
              : '/dashboard/creditos'
          }
          className="text-sm text-rose-700 hover:underline"
        >
          ← Volver
        </Link>
        <h1 className="text-2xl font-bold text-slate-800 mt-2">
          {isRefinancing ? 'Refinanciar crédito' : 'Nuevo crédito'}
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          {isRefinancing
            ? 'Se creará un crédito consolidado con el saldo anterior y nuevos materiales'
            : 'La solicitud inicia en estado pendiente de autorización'}
        </p>
      </div>
      <NuevoCreditoClient
        userId={user.id}
        initialClientId={clientId || ''}
        refinanceFromId={refinanceFrom || ''}
      />
    </div>
  );
}
