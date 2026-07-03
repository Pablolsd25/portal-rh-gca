import { createClient } from '@/lib/supabase/client';
import type { LineaDetalle } from './nomina';

export async function borrarRegistroNomina(linea: LineaDetalle): Promise<string | null> {
  if (!linea.registroId || !linea.tabla) return 'Registro no eliminable';

  const supabase = createClient();

  if (linea.tabla === 'bitacora_embarques' && linea.campoEmbarque) {
    const { data, error: fetchErr } = await supabase
      .from('bitacora_embarques')
      .select('*')
      .eq('id', linea.registroId)
      .single();
    if (fetchErr || !data) return fetchErr?.message ?? 'No encontrado';

    const patch: Record<string, unknown> = {};
    if (linea.campoEmbarque === 'operador') {
      patch.importe_operador = 0;
    } else if (linea.campoEmbarque === 'ayudante1') {
      patch.ayudante1_id = null;
      patch.importe_ayudante1 = 0;
    } else {
      patch.ayudante2_id = null;
      patch.importe_ayudante2 = 0;
    }

    const restante =
      (linea.campoEmbarque === 'operador' ? 0 : Number(data.importe_operador)) +
      (linea.campoEmbarque === 'ayudante1' ? 0 : Number(data.importe_ayudante1)) +
      (linea.campoEmbarque === 'ayudante2' ? 0 : Number(data.importe_ayudante2));

    if (restante <= 0) {
      const { error } = await supabase.from('bitacora_embarques').delete().eq('id', linea.registroId);
      return error?.message ?? null;
    }

    const { error } = await supabase.from('bitacora_embarques').update(patch).eq('id', linea.registroId);
    return error?.message ?? null;
  }

  const { data, error } = await supabase.from(linea.tabla).delete().eq('id', linea.registroId).select('id');
  if (error) return error.message;
  if (!data?.length) return 'No se pudo eliminar. Verifica permisos.';
  return null;
}
