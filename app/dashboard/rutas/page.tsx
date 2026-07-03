import { createClient } from '@/lib/supabase/server';
import RutasClient from './RutasClient';
import { puedeProgramarRuta } from '@/lib/auth';
import {
  syncPedidosDelDia,
  getPedidosPorProgramar,
  getRutaEntrega,
  hoyISO,
  mananaISO,
  type PedidoEntrega,
} from '@/lib/rutas';

export default async function RutasPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; entrega?: string; vista?: string }>;
}) {
  const { fecha, entrega, vista } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: staffUser } = await supabase
    .from('staff_users')
    .select('role, sucursal')
    .eq('id', user!.id)
    .single();

  const puedeProgramar = puedeProgramarRuta(staffUser?.role);
  const sucursal = staffUser?.sucursal ?? null;
  const fechaVenta = fecha ?? hoyISO();
  const fechaEntrega = entrega ?? mananaISO();
  let vistaActiva: 'bascula' | 'programar' | 'ruta' =
    vista === 'programar' || vista === 'ruta' ? vista : 'bascula';
  if (!puedeProgramar && vistaActiva !== 'bascula') vistaActiva = 'bascula';

  let pedidosDia: PedidoEntrega[] = [];
  let pedidosPorProgramar: PedidoEntrega[] = [];
  let ruta: PedidoEntrega[] = [];
  let syncError: string | null = null;

  try {
    [pedidosDia, pedidosPorProgramar, ruta] = await Promise.all([
      syncPedidosDelDia(supabase, fechaVenta, sucursal),
      puedeProgramar ? getPedidosPorProgramar(supabase) : Promise.resolve([]),
      vistaActiva === 'ruta' && puedeProgramar
        ? getRutaEntrega(supabase, fechaEntrega)
        : Promise.resolve([]),
    ]);
  } catch (err) {
    syncError = err instanceof Error ? err.message : 'Error al sincronizar ventas';
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Rutas de entrega</h1>
        <p className="text-sm text-slate-600 mt-1">
          Ventas del día → báscula → programación → ruta
        </p>
      </div>

      {syncError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          <p className="font-medium">No se pudieron cargar las ventas</p>
          <p className="mt-1 text-red-600">{syncError}</p>
          <p className="mt-2 text-xs text-red-500">
            Si dice RLS en entregas_programadas, ejecuta <code className="bg-red-100 px-1 rounded">schema_rutas_rls_fix.sql</code> en Supabase.
          </p>
        </div>
      )}

      <RutasClient
        userId={user!.id}
        puedeProgramar={puedeProgramar}
        sucursal={sucursal}
        fechaVenta={fechaVenta}
        fechaEntrega={fechaEntrega}
        vistaActiva={vistaActiva}
        pedidosDia={pedidosDia}
        pedidosPorProgramar={pedidosPorProgramar}
        ruta={ruta}
      />
    </div>
  );
}
