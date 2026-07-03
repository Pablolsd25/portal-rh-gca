import { createClient } from '@/lib/supabase/client';
import type { LineaDetalle } from './nomina';

export async function editarImporteNomina(linea: LineaDetalle, importe: number): Promise<string | null> {
  if (!linea.registroId || !linea.tabla) return 'Registro no editable';

  const supabase = createClient();

  if (linea.tabla === 'bitacora_embarques' && linea.campoEmbarque) {
    const campo = {
      operador: 'importe_operador',
      ayudante1: 'importe_ayudante1',
      ayudante2: 'importe_ayudante2',
    }[linea.campoEmbarque];
    const { error } = await supabase.from('bitacora_embarques').update({ [campo]: importe }).eq('id', linea.registroId);
    return error?.message ?? null;
  }

  if (linea.tabla === 'bonos_doblado') {
    const { error } = await supabase.from('bonos_doblado').update({ importe }).eq('id', linea.registroId);
    return error?.message ?? null;
  }

  if (linea.tabla === 'bonos_enderezado') {
    const califica = importe > 0;
    const { error } = await supabase.from('bonos_enderezado').update({ califica, importe: califica ? 50 : 0 }).eq('id', linea.registroId);
    return error?.message ?? null;
  }

  if (linea.tabla === 'bonos_anillos') {
    const kilos = importe / 0.5;
    const { error } = await supabase.from('bonos_anillos').update({ kilos, importe }).eq('id', linea.registroId);
    return error?.message ?? null;
  }

  const patch: Record<string, number> = { importe };
  const { data, error } = await supabase.from(linea.tabla).update(patch).eq('id', linea.registroId).select('id');
  if (error) return error.message;
  if (!data?.length) return 'No se pudo editar. Verifica permisos.';
  return null;
}
