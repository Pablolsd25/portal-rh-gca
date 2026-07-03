import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import PeriodoSelect from './PeriodoSelect';
import NominaExcelTable, { type FilaNominaExcel } from './NominaExcelTable';
import NominaDiariaView from './NominaDiariaView';
import { montosVacios, detalleVacio, totalNeto, totalIngresos, fmtNomina } from '@/lib/nomina';
import type { CeldaDetalle } from '@/lib/nomina';
import { agregarProduccion, agregarExtra } from '@/lib/agregarDetalle';

export default async function NominaPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; vista?: string }>;
}) {
  const { periodo: periodoId, vista } = await searchParams;
  const supabase = await createClient();

  const { data: periodos } = await supabase
    .from('periodos_nomina')
    .select('*')
    .order('fecha_inicio', { ascending: false });

  if (!periodos || periodos.length === 0) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-800 mb-4">Nómina semanal</h1>
        <p className="text-slate-400">No hay periodos registrados.</p>
      </div>
    );
  }

  const periodo = periodoId
    ? periodos.find(p => p.id === periodoId) ?? periodos[0]
    : periodos[0];

  const [
    { data: empleados },
    { data: embarques },
    { data: doblados },
    { data: enderezados },
    { data: anillos },
    { data: descargas },
    { data: extras },
  ] = await Promise.all([
    supabase.from('empleados').select('*').eq('activo', true).order('nombre'),
    supabase.from('bitacora_embarques').select('*').eq('periodo_id', periodo.id),
    supabase.from('bonos_doblado').select('*').eq('periodo_id', periodo.id),
    supabase.from('bonos_enderezado').select('*').eq('periodo_id', periodo.id),
    supabase.from('bonos_anillos').select('*').eq('periodo_id', periodo.id),
    supabase.from('bonos_descargas').select('*').eq('periodo_id', periodo.id),
    supabase.from('produccion_extra').select('*').eq('periodo_id', periodo.id),
  ]);

  const nomMontos: Record<string, ReturnType<typeof montosVacios>> = {};
  const nomDetalle: Record<string, ReturnType<typeof detalleVacio>> = {};
  const celdaMap: Record<string, Record<string, CeldaDetalle>> = {};

  const init = (empId: string) => {
    if (!nomMontos[empId]) {
      nomMontos[empId] = montosVacios();
      nomDetalle[empId] = detalleVacio();
    }
  };

  (empleados ?? []).forEach(e => {
    init(e.id);
    nomMontos[e.id].sueldo = Number(e.sueldo_base_semanal);
  });

  extras?.forEach(r => {
    init(r.empleado_id);
    agregarExtra(celdaMap, nomMontos, nomDetalle, r.empleado_id, r.fecha, r.concepto, Number(r.importe), r.observaciones, r.id);
  });

  embarques?.forEach(r => {
    const det = (rol: 'operador' | 'ayudante1' | 'ayudante2', label: string, id: string | null, imp: number) => {
      if (!id || imp <= 0) return;
      init(id);
      agregarProduccion(celdaMap, nomMontos, nomDetalle, id, r.fecha, 'Embarque', imp, `${String(r.tipo_unidad)} · ${label}`,
        { registroId: r.id, tabla: 'bitacora_embarques', campoEmbarque: rol });
    };
    det('operador', 'Operador', r.operador_id, Number(r.importe_operador));
    det('ayudante1', 'Ayudante 1', r.ayudante1_id, Number(r.importe_ayudante1));
    det('ayudante2', 'Ayudante 2', r.ayudante2_id, Number(r.importe_ayudante2));
  });

  doblados?.forEach(r => {
    init(r.empleado_id);
    agregarProduccion(celdaMap, nomMontos, nomDetalle, r.empleado_id, r.fecha, 'Doblado', Number(r.importe), `${r.toneladas} ton`,
      { registroId: r.id, tabla: 'bonos_doblado' });
  });

  enderezados?.forEach(r => {
    init(r.empleado_id);
    agregarProduccion(celdaMap, nomMontos, nomDetalle, r.empleado_id, r.fecha, 'Enderezado', Number(r.importe), `${r.kilos} kg`,
      { registroId: r.id, tabla: 'bonos_enderezado' });
  });

  anillos?.forEach(r => {
    init(r.empleado_id);
    agregarProduccion(celdaMap, nomMontos, nomDetalle, r.empleado_id, r.fecha, 'Anillos', Number(r.importe), `${r.kilos} kg`,
      { registroId: r.id, tabla: 'bonos_anillos' });
  });

  descargas?.forEach(r => {
    init(r.empleado_id);
    agregarProduccion(celdaMap, nomMontos, nomDetalle, r.empleado_id, r.fecha, 'Descarga', Number(r.importe), String(r.tipo_vehiculo),
      { registroId: r.id, tabla: 'bonos_descargas' });
  });

  const filas: FilaNominaExcel[] = (empleados ?? [])
    .map(emp => ({
      id: emp.id,
      nombre: emp.nombre,
      montos: nomMontos[emp.id] ?? montosVacios(),
      detalle: nomDetalle[emp.id] ?? detalleVacio(),
    }))
    .filter(f => totalNeto(f.montos) > 0 || f.montos.sueldo > 0)
    .sort((a, b) => totalNeto(b.montos) - totalNeto(a.montos));

  const totalGeneral = filas.reduce((s, f) => s + totalNeto(f.montos), 0);
  const totalIng = filas.reduce((s, f) => s + totalIngresos(f.montos), 0);
  const conMovimiento = filas.filter(f => totalNeto(f.montos) !== f.montos.sueldo).length;
  const vistaExcel = vista !== 'diario';

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Nómina semanal</h1>
          <p className="text-sm text-slate-500 mt-1">
            Semana del{' '}
            {new Date(periodo.fecha_inicio + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'long' })}
            {' al '}
            {new Date(periodo.fecha_fin + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <PeriodoSelect periodos={periodos} value={periodo.id} />
          <Link href={`/dashboard/bitacora?periodo=${periodo.id}`}
            className="px-4 py-2 border border-emerald-600 text-emerald-700 hover:bg-emerald-50 text-sm font-medium rounded-lg transition-colors">
            Ver bitácora
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Total efvo', value: fmtNomina(totalGeneral), cls: 'bg-emerald-800 text-white border-emerald-900' },
          { label: 'Tot ingresos', value: fmtNomina(totalIng), cls: 'bg-emerald-50 text-emerald-900 border-emerald-200' },
          { label: 'Empleados', value: String(filas.length), cls: 'bg-white border-slate-200' },
          { label: 'Con movimientos', value: String(conMovimiento), cls: 'bg-white border-slate-200' },
        ].map(k => (
          <div key={k.label} className={`rounded-xl border px-4 py-3 ${k.cls}`}>
            <p className={`text-[10px] font-semibold uppercase tracking-wide ${k.cls.includes('text-white') ? 'text-emerald-200' : 'text-slate-500'}`}>{k.label}</p>
            <p className="text-2xl font-bold mt-0.5">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
          periodo.estado === 'abierto' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
        }`}>{periodo.estado}</span>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          <Link
            href={`/dashboard/nomina?periodo=${periodo.id}`}
            className={`px-3 py-1.5 rounded-md text-xs font-medium ${vistaExcel ? 'bg-white shadow text-emerald-800' : 'text-slate-500'}`}
          >
            Formato Excel
          </Link>
          <Link
            href={`/dashboard/nomina?periodo=${periodo.id}&vista=diario`}
            className={`px-3 py-1.5 rounded-md text-xs font-medium ${!vistaExcel ? 'bg-white shadow text-emerald-800' : 'text-slate-500'}`}
          >
            Por día
          </Link>
        </div>
      </div>

      {vistaExcel ? (
        <NominaExcelTable filas={filas} periodoId={periodo.id} fechaCorte={periodo.fecha_fin} />
      ) : (
        <NominaDiariaView filas={filas} inicio={periodo.fecha_inicio} fin={periodo.fecha_fin} celdaMap={celdaMap} />
      )}
    </div>
  );
}
