import { createClient } from '@/lib/supabase/server';
import { getQuote, listFrequentClients } from '@/lib/ventas/quotes';
import CotizadorClient from './CotizadorClient';

type Props = {
  searchParams: Promise<{
    id?: string;
    nombre?: string;
    telefono?: string;
    direccion?: string;
    ubicacion?: string;
  }>;
};

export default async function CotizadorPage({ searchParams }: Props) {
  const { id, nombre, telefono, direccion, ubicacion } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: staff } = await supabase
    .from('staff_users')
    .select('id, full_name, role, sucursal')
    .eq('id', user!.id)
    .single();

  let quote = null;
  let clients: Awaited<ReturnType<typeof listFrequentClients>> = [];
  let loadError: string | null = null;

  try {
    clients = await listFrequentClients(supabase, user!.id);
    if (id) {
      quote = await getQuote(supabase, id);
      if (!quote) loadError = `Cotización ${id} no encontrada`;
    }
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Error al cargar cotizador';
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
          {quote ? 'Editar cotización' : 'Nueva Cotización'}
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Cliente, entrega, razón social, conceptos y facturación
        </p>
      </div>

      {loadError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {!loadError && staff && (
        <CotizadorClient
          userId={user!.id}
          userName={staff.full_name}
          userSucursal={staff.sucursal}
          initialQuote={quote}
          frequentClients={clients}
          prefill={
            !quote
              ? {
                  nombre: nombre || '',
                  telefono: telefono || '',
                  direccion: direccion || ubicacion || '',
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
