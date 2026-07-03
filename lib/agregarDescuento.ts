import { createClient } from '@/lib/supabase/client';

export async function agregarDescuentoNomina(
  periodoId: string,
  empleadoId: string,
  fecha: string,
  concepto: string,
  monto: number,
): Promise<string | null> {
  const supabase = createClient();
  const importe = -Math.abs(monto);
  const { data, error } = await supabase.from('produccion_extra').insert({
    periodo_id: periodoId,
    empleado_id: empleadoId,
    fecha,
    concepto,
    importe,
  }).select('id');
  if (error) return error.message;
  if (!data?.length) return 'No se pudo guardar. Verifica permisos.';
  return null;
}
