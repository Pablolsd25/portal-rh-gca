import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import BitacoraComercialClient from './BitacoraComercialClient';

type Props = {
  searchParams: Promise<{ prospectId?: string; clientId?: string }>;
};

export default async function BitacoraComercialPage({ searchParams }: Props) {
  const { prospectId, clientId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Bitácora comercial</h1>
        <p className="text-sm text-slate-600 mt-1">Seguimientos a prospectos y clientes</p>
      </div>
      <BitacoraComercialClient
        userId={user.id}
        initialProspectId={prospectId || null}
        initialClientId={clientId || null}
      />
    </div>
  );
}
