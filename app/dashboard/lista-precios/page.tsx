import { createClient } from '@/lib/supabase/server';
import { getListaMeta, listMateriales } from '@/lib/listaPrecios';
import ListaPreciosClient from './ListaPreciosClient';
import { puedeEditarListaPrecios } from '@/lib/auth';

export default async function ListaPreciosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: staff } = await supabase
    .from('staff_users')
    .select('role')
    .eq('id', user!.id)
    .single();

  const canEdit = puedeEditarListaPrecios(staff?.role);

  let meta = null;
  let materiales: Awaited<ReturnType<typeof listMateriales>> = [];
  let loadError: string | null = null;

  try {
    [meta, materiales] = await Promise.all([getListaMeta(supabase), listMateriales(supabase)]);
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Error al cargar lista de precios';
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Lista de precios</h1>
          <p className="text-sm text-slate-600 mt-1">
            Materiales · Materialista / Edo. Mex / CDMX
            {canEdit ? ' · editable y descargable en Excel' : ' · consulta y descarga Excel'}
          </p>
        </div>
        {!loadError && (
          <a
            href="/api/lista-precios/excel"
            className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg"
          >
            Descargar Excel
          </a>
        )}
      </div>

      {loadError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          <p className="font-medium">No se pudo cargar la lista</p>
          <p className="mt-1">{loadError}</p>
          <p className="mt-2 text-xs text-red-500">
            Ejecuta en Supabase: <code className="bg-red-100 px-1 rounded">schema_lista_precios.sql</code> y luego{' '}
            <code className="bg-red-100 px-1 rounded">seed_lista_precios.sql</code>
          </p>
        </div>
      )}

      {!loadError && meta && (
        <ListaPreciosClient
          userId={user!.id}
          meta={meta}
          materiales={materiales}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
