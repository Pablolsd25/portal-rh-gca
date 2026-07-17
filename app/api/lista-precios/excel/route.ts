import { createClient } from '@/lib/supabase/server';
import { getListaMeta, listMateriales } from '@/lib/listaPrecios';
import { buildListaPreciosWorkbook } from '@/lib/exportListaPrecios';
import { puedeLeerListaPrecios } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return new Response('No autorizado', { status: 401 });
    }

    const { data: staff } = await supabase
      .from('staff_users')
      .select('role, is_active')
      .eq('id', user.id)
      .single();

    if (!staff?.is_active || !puedeLeerListaPrecios(staff.role)) {
      return new Response('Sin permiso', { status: 403 });
    }

    const [meta, materiales] = await Promise.all([getListaMeta(supabase), listMateriales(supabase)]);
    const buffer = await buildListaPreciosWorkbook(meta, materiales);
    const fecha = meta.fecha_vigencia?.replaceAll('-', '') || 'vigente';
    const filename = `LISTA_DE_PRECIOS_${fecha}.xlsx`;

    return new Response(Buffer.from(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al exportar';
    return new Response(msg, { status: 500 });
  }
}
