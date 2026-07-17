import { createClient } from '@/lib/supabase/server';
import { listQuotes } from '@/lib/ventas/quotes';
import CotizacionesClient from './CotizacionesClient';

export default async function CotizacionesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: staff } = await supabase
    .from('staff_users')
    .select('id, full_name, role, sucursal')
    .eq('id', user!.id)
    .single();

  let quotes: Awaited<ReturnType<typeof listQuotes>> = [];
  let loadError: string | null = null;

  try {
    quotes = await listQuotes(supabase, {
      userId: user!.id,
      role: staff?.role ?? '',
    });
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Error al cargar cotizaciones';
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Cotizaciones</h1>
        <p className="text-sm text-slate-600 mt-1">Listado, registro de pago y descarga de PDF</p>
      </div>

      {loadError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {!loadError && staff && (
        <CotizacionesClient
          initialQuotes={quotes}
          userId={user!.id}
          userRole={staff.role}
          userName={staff.full_name}
          userSucursal={staff.sucursal}
        />
      )}
    </div>
  );
}
