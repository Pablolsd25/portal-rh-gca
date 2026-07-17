import { createClient } from '@/lib/supabase/server';
import { listQuotesForAprobacion } from '@/lib/ventas/quotes';
import AprobacionPagosClient from './AprobacionPagosClient';

export default async function AprobacionPagosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: staff } = await supabase
    .from('staff_users')
    .select('id, full_name, role, sucursal')
    .eq('id', user!.id)
    .single();

  let quotes: Awaited<ReturnType<typeof listQuotesForAprobacion>> = [];
  let loadError: string | null = null;

  try {
    quotes = await listQuotesForAprobacion(supabase);
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Error al cargar pagos';
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Aprobación y gestión de pagos</h1>
        <p className="text-sm text-slate-600 mt-1">
          Pendientes · transferencias/depósitos aprobados · PPD y crédito
        </p>
      </div>

      {loadError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {!loadError && staff && (
        <AprobacionPagosClient
          initialQuotes={quotes}
          userId={user!.id}
          userName={staff.full_name}
          userSucursal={staff.sucursal ?? null}
        />
      )}
    </div>
  );
}
