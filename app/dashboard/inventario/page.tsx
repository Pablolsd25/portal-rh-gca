import { createClient } from '@/lib/supabase/server';
import { listMovimientos, listProductos } from '@/lib/inventario';
import InventarioClient from './InventarioClient';

export default async function InventarioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let productos: Awaited<ReturnType<typeof listProductos>> = [];
  let movimientos: Awaited<ReturnType<typeof listMovimientos>> = [];
  let loadError: string | null = null;

  try {
    [productos, movimientos] = await Promise.all([
      listProductos(supabase),
      listMovimientos(supabase, 80),
    ]);
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Error al cargar inventario';
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Inventario</h1>
        <p className="text-sm text-slate-600 mt-1">Control de stock de productos · entradas, salidas y ajustes</p>
      </div>

      {loadError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          <p className="font-medium">No se pudo cargar el inventario</p>
          <p className="mt-1">{loadError}</p>
          <p className="mt-2 text-xs text-red-500">
            Ejecuta <code className="bg-red-100 px-1 rounded">schema_inventario.sql</code> en el SQL Editor de Supabase.
          </p>
        </div>
      )}

      {!loadError && (
        <InventarioClient userId={user!.id} productos={productos} movimientos={movimientos} />
      )}
    </div>
  );
}
