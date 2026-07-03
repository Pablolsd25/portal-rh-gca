import { createClient } from '@/lib/supabase/server';
import BitacoraClient from './BitacoraClient';
import { fechasPeriodo } from '@/lib/semana';
import type { FilaResumen } from '@/components/ResumenSemanaGrid';
import type { CeldaDetalle } from '@/lib/nomina';
import { agregarProduccion, agregarExtra } from '@/lib/agregarDetalle';
import { montosVacios, detalleVacio } from '@/lib/nomina';

export default async function BitacoraPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; fecha?: string; vista?: string }>;
}) {
  const { periodo: periodoId, fecha, vista } = await searchParams;
  const supabase = await createClient();

  const [{ data: periodos }, { data: empleados }] = await Promise.all([
    supabase.from('periodos_nomina').select('*').order('fecha_inicio', { ascending: false }),
    supabase.from('empleados').select('id, nombre, puesto').eq('activo', true).order('nombre'),
  ]);

  if (!periodos || periodos.length === 0) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-800 mb-4">Bitácora semanal</h1>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <p className="text-amber-800 font-medium">No hay periodos registrados.</p>
          <p className="text-amber-700 text-sm mt-1">Abre un periodo en la sección de Periodos para empezar a capturar.</p>
        </div>
      </div>
    );
  }

  const periodoActivo = periodoId
    ? periodos.find(p => p.id === periodoId) ?? periodos[0]
    : periodos.find(p => p.estado === 'abierto') ?? periodos[0];

  const dias = fechasPeriodo(periodoActivo.fecha_inicio, periodoActivo.fecha_fin);
  const fechasDisponibles = dias.filter(d => d.esLaboral).map(d => d.iso);

  const fechaSeleccionada = fecha && fechasDisponibles.includes(fecha)
    ? fecha
    : fechasDisponibles[fechasDisponibles.length - 1] ?? fechasDisponibles[0];

  const [
    { data: embarquesPeriodo },
    { data: dobladosPeriodo },
    { data: enderezadosPeriodo },
    { data: anillosPeriodo },
    { data: descargasPeriodo },
    { data: extrasPeriodo },
    { data: embarques },
    { data: doblados },
    { data: enderezados },
    { data: anillos },
    { data: descargas },
    { data: extras },
  ] = await Promise.all([
    supabase.from('bitacora_embarques').select('*').eq('periodo_id', periodoActivo.id),
    supabase.from('bonos_doblado').select('*').eq('periodo_id', periodoActivo.id),
    supabase.from('bonos_enderezado').select('*').eq('periodo_id', periodoActivo.id),
    supabase.from('bonos_anillos').select('*').eq('periodo_id', periodoActivo.id),
    supabase.from('bonos_descargas').select('*').eq('periodo_id', periodoActivo.id),
    supabase.from('produccion_extra').select('*').eq('periodo_id', periodoActivo.id),
    supabase.from('bitacora_embarques').select('*, operador:empleados!bitacora_embarques_operador_id_fkey(nombre), ayudante1:empleados!bitacora_embarques_ayudante1_id_fkey(nombre), ayudante2:empleados!bitacora_embarques_ayudante2_id_fkey(nombre)')
      .eq('periodo_id', periodoActivo.id).eq('fecha', fechaSeleccionada),
    supabase.from('bonos_doblado').select('*, empleado:empleados(nombre)').eq('periodo_id', periodoActivo.id).eq('fecha', fechaSeleccionada),
    supabase.from('bonos_enderezado').select('*, empleado:empleados(nombre)').eq('periodo_id', periodoActivo.id).eq('fecha', fechaSeleccionada),
    supabase.from('bonos_anillos').select('*, empleado:empleados(nombre)').eq('periodo_id', periodoActivo.id).eq('fecha', fechaSeleccionada),
    supabase.from('bonos_descargas').select('*, empleado:empleados(nombre)').eq('periodo_id', periodoActivo.id).eq('fecha', fechaSeleccionada),
    supabase.from('produccion_extra').select('*, empleado:empleados(nombre)').eq('periodo_id', periodoActivo.id).eq('fecha', fechaSeleccionada),
  ]);

  const celdaMap: Record<string, Record<string, CeldaDetalle>> = {};
  const nomMontos: Record<string, ReturnType<typeof montosVacios>> = {};
  const nomDetalle: Record<string, ReturnType<typeof detalleVacio>> = {};

  const init = (id: string) => {
    if (!nomMontos[id]) { nomMontos[id] = montosVacios(); nomDetalle[id] = detalleVacio(); }
  };

  extrasPeriodo?.forEach(r => {
    init(r.empleado_id);
    agregarExtra(celdaMap, nomMontos, nomDetalle, r.empleado_id, r.fecha, r.concepto, Number(r.importe), r.observaciones);
  });

  embarquesPeriodo?.forEach(r => {
    const add = (empId: string | null, rol: string, imp: number) => {
      if (!empId || imp <= 0) return;
      init(empId);
      agregarProduccion(celdaMap, nomMontos, nomDetalle, empId, r.fecha, 'Embarque / vuelta', imp,
        `${String(r.tipo_unidad)} · ${rol} ($${imp})`);
    };
    add(r.operador_id, 'Operador', Number(r.importe_operador));
    add(r.ayudante1_id, 'Ayudante 1', Number(r.importe_ayudante1));
    add(r.ayudante2_id, 'Ayudante 2', Number(r.importe_ayudante2));
  });

  dobladosPeriodo?.forEach(r => {
    init(r.empleado_id);
    agregarProduccion(celdaMap, nomMontos, nomDetalle, r.empleado_id, r.fecha, 'Doblado varilla',
      Number(r.importe), `${r.toneladas} ton${Number(r.importe) > 0 ? ` · ${Math.round(Number(r.importe) / 30)} ton pagables` : ' · bajo cuota'}`);
  });

  enderezadosPeriodo?.forEach(r => {
    init(r.empleado_id);
    agregarProduccion(celdaMap, nomMontos, nomDetalle, r.empleado_id, r.fecha, 'Enderezado',
      Number(r.importe), `${r.kilos} kg${r.califica ? ' · califica' : ''}`);
  });

  anillosPeriodo?.forEach(r => {
    init(r.empleado_id);
    agregarProduccion(celdaMap, nomMontos, nomDetalle, r.empleado_id, r.fecha, 'Anillos',
      Number(r.importe), `${r.kilos} kg × $0.50`);
  });

  descargasPeriodo?.forEach(r => {
    init(r.empleado_id);
    agregarProduccion(celdaMap, nomMontos, nomDetalle, r.empleado_id, r.fecha, 'Descarga',
      Number(r.importe), String(r.tipo_vehiculo));
  });

  const totalesPorDia: Record<string, number> = {};
  dias.forEach(d => { totalesPorDia[d.iso] = 0; });
  Object.values(celdaMap).forEach(porFecha => {
    Object.entries(porFecha).forEach(([f, c]) => { totalesPorDia[f] = (totalesPorDia[f] ?? 0) + c.total; });
  });

  let maxCelda = 0;
  const filasResumen: FilaResumen[] = (empleados ?? []).map(emp => {
    const porDia: Record<string, number> = {};
    const detallePorDia = celdaMap[emp.id] ?? {};
    Object.entries(detallePorDia).forEach(([f, c]) => {
      porDia[f] = c.total;
      if (c.total > maxCelda) maxCelda = c.total;
    });
    const total = Object.values(porDia).reduce((s, v) => s + v, 0);
    return { id: emp.id, nombre: emp.nombre, porDia, total, detallePorDia };
  }).sort((a, b) => b.total - a.total);

  const vistaActiva = vista === 'dia' ? 'dia' : 'semana';
  const soloLectura = periodoActivo.estado === 'cerrado';

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <BitacoraClient
        periodos={periodos}
        periodoActivo={periodoActivo}
        empleados={empleados ?? []}
        dias={dias}
        fechasDisponibles={fechasDisponibles}
        fechaSeleccionada={fechaSeleccionada}
        totalesPorDia={totalesPorDia}
        filasResumen={filasResumen}
        maxCelda={maxCelda}
        vistaActiva={vistaActiva}
        soloLectura={soloLectura}
        embarques={embarques ?? []}
        doblados={doblados ?? []}
        enderezados={enderezados ?? []}
        anillos={anillos ?? []}
        descargas={descargas ?? []}
        extras={extras ?? []}
      />
    </div>
  );
}
