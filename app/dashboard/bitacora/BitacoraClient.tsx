'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { calcularVuelta, calcularDoblado, calcularEnderezado, calcularAnillos, calcularDescarga, cuotaDoblado } from '@/lib/calculos';
import type { TipoUnidad, TipoVehiculo } from '@/lib/calculos';
import SemanaMosaico from '@/components/SemanaMosaico';
import ResumenSemanaGrid, { type FilaResumen } from '@/components/ResumenSemanaGrid';
import { fmtDia, fmtMoney, type DiaSemana } from '@/lib/semana';
import { fmtNomina } from '@/lib/nomina';

interface Empleado { id: string; nombre: string; puesto: string; }
interface Periodo { id: string; fecha_inicio: string; fecha_fin: string; estado: string; }

interface Props {
  periodos: Periodo[];
  periodoActivo: Periodo;
  empleados: Empleado[];
  dias: DiaSemana[];
  fechasDisponibles: string[];
  fechaSeleccionada: string;
  totalesPorDia: Record<string, number>;
  filasResumen: FilaResumen[];
  maxCelda: number;
  vistaActiva: 'semana' | 'dia';
  soloLectura: boolean;
  embarques: Record<string, unknown>[];
  doblados: Record<string, unknown>[];
  enderezados: Record<string, unknown>[];
  anillos: Record<string, unknown>[];
  descargas: Record<string, unknown>[];
  extras: Record<string, unknown>[];
}

// Sección Embarques
function SeccionEmbarques({ periodoId, fecha, empleados, registros }: {
  periodoId: string; fecha: string; empleados: Empleado[]; registros: Record<string, unknown>[];
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoUnidad>('freightliner');
  const [operadorId, setOperadorId] = useState('');
  const [ayudante1Id, setAyudante1Id] = useState('');
  const [ayudante2Id, setAyudante2Id] = useState('');
  const [obs, setObs] = useState('');
  const [loading, setLoading] = useState(false);

  const tarifas = calcularVuelta(tipo);

  const guardar = async () => {
    if (!operadorId) return;
    setLoading(true);
    const supabase = createClient();
    await supabase.from('bitacora_embarques').insert({
      periodo_id: periodoId,
      fecha,
      tipo_unidad: tipo,
      operador_id: operadorId,
      ayudante1_id: ayudante1Id || null,
      ayudante2_id: ayudante2Id || null,
      importe_operador: tarifas.operador,
      importe_ayudante1: ayudante1Id ? tarifas.ayudante : 0,
      importe_ayudante2: ayudante2Id ? tarifas.ayudante : 0,
      observaciones: obs || null,
    });
    setOperadorId(''); setAyudante1Id(''); setAyudante2Id(''); setObs('');
    router.refresh();
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <h3 className="text-sm font-bold text-slate-700 mb-3">🚛 Embarques / Vueltas</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Unidad</label>
          <select value={tipo} onChange={e => setTipo(e.target.value as TipoUnidad)}
            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="freightliner">Freightliner</option>
            <option value="isuzu">Isuzu</option>
            <option value="ford">Ford</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Operador <span className="text-emerald-600">(${tarifas.operador})</span></label>
          <select value={operadorId} onChange={e => setOperadorId(e.target.value)}
            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">— Seleccionar —</option>
            {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Ayudante 1 <span className="text-emerald-600">(${tarifas.ayudante})</span></label>
          <select value={ayudante1Id} onChange={e => setAyudante1Id(e.target.value)}
            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">— Ninguno —</option>
            {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Ayudante 2 <span className="text-emerald-600">(${tarifas.ayudante})</span></label>
          <select value={ayudante2Id} onChange={e => setAyudante2Id(e.target.value)}
            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">— Ninguno —</option>
            {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-3 mb-4">
        <input value={obs} onChange={e => setObs(e.target.value)} placeholder="Observaciones (opcional)"
          className="flex-1 px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        <button onClick={guardar} disabled={loading || !operadorId}
          className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-medium rounded-lg transition-colors">
          {loading ? '...' : 'Agregar'}
        </button>
      </div>
      {registros.length > 0 && (
        <table className="w-full text-xs">
          <thead><tr className="text-slate-500"><th className="text-left pb-1">Unidad</th><th className="text-left pb-1">Operador</th><th className="text-left pb-1">Ay.1</th><th className="text-left pb-1">Ay.2</th><th className="text-right pb-1">Total</th></tr></thead>
          <tbody className="divide-y divide-slate-50">
            {registros.map((r: Record<string, unknown>) => {
              const op = r.operador as { nombre?: string } | null;
              const ay1 = r.ayudante1 as { nombre?: string } | null;
              const ay2 = r.ayudante2 as { nombre?: string } | null;
              const total = Number(r.importe_operador) + Number(r.importe_ayudante1) + Number(r.importe_ayudante2);
              return (
                <tr key={r.id as string} className="text-slate-700">
                  <td className="py-1 capitalize">{String(r.tipo_unidad)}</td>
                  <td className="py-1">{op?.nombre ?? '—'} <span className="text-emerald-600">${r.importe_operador as number}</span></td>
                  <td className="py-1">{ay1?.nombre ?? '—'} {ay1 && <span className="text-emerald-600">${r.importe_ayudante1 as number}</span>}</td>
                  <td className="py-1">{ay2?.nombre ?? '—'} {ay2 && <span className="text-emerald-600">${r.importe_ayudante2 as number}</span>}</td>
                  <td className="py-1 text-right font-semibold">${total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Sección Doblado — cuota 16 ton (lun–vie) o 10 ton (sáb), $30 solo sobre excedente
function SeccionDoblado({ periodoId, fecha, empleados, registros }: {
  periodoId: string; fecha: string; empleados: Empleado[]; registros: Record<string, unknown>[];
}) {
  const router = useRouter();
  const [empleadoId, setEmpleadoId] = useState('');
  const [toneladas, setToneladas] = useState('');
  const [obs, setObs] = useState('');
  const [loading, setLoading] = useState(false);

  const cuota = cuotaDoblado(fecha);
  const acumulado = empleadoId
    ? registros.filter(r => r.empleado_id === empleadoId).reduce((s, r) => s + Number(r.toneladas), 0)
    : 0;
  const preview = toneladas
    ? calcularDoblado(Number(toneladas), fecha, acumulado)
    : null;

  const guardar = async () => {
    if (!empleadoId || !toneladas) return;
    setLoading(true);
    const calc = calcularDoblado(Number(toneladas), fecha, acumulado);
    const supabase = createClient();
    await supabase.from('bonos_doblado').insert({
      periodo_id: periodoId,
      fecha,
      empleado_id: empleadoId,
      toneladas: calc.toneladas,
      importe: calc.importe,
      observaciones: obs || null,
    });
    setEmpleadoId(''); setToneladas(''); setObs('');
    router.refresh();
    setLoading(false);
  };

  const diaSemana = new Date(fecha + 'T00:00:00').getDay();
  const esSabado = diaSemana === 6;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <h3 className="text-sm font-bold text-slate-700 mb-1">🔧 Doblado de varilla</h3>
      <p className="text-xs text-slate-500 mb-3">
        Cuota del día: <strong>{cuota} ton</strong> ({esSabado ? 'sábado' : 'lun–vie'}) ·
        $30/ton solo sobre toneladas <em>después</em> de la cuota
      </p>
      <div className="flex flex-wrap gap-3 mb-3">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Empleado</label>
          <select value={empleadoId} onChange={e => setEmpleadoId(e.target.value)}
            className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">— Seleccionar —</option>
            {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Toneladas (enteras)</label>
          <input type="number" min="0" step="1" value={toneladas} onChange={e => setToneladas(e.target.value)}
            placeholder="0"
            className="w-28 px-2 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        {empleadoId && acumulado > 0 && (
          <div className="flex items-end">
            <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1.5 rounded-lg">
              Ya lleva {acumulado} ton hoy
            </p>
          </div>
        )}
        {preview && preview.tonPagables > 0 && (
          <div className="flex items-end">
            <p className="text-xs text-emerald-700 bg-emerald-50 px-2 py-1.5 rounded-lg font-medium">
              +{preview.tonPagables} ton pagables → ${preview.importe}
            </p>
          </div>
        )}
        {preview && preview.tonPagables === 0 && Number(toneladas) > 0 && (
          <div className="flex items-end">
            <p className="text-xs text-slate-500 bg-slate-50 px-2 py-1.5 rounded-lg">
              Aún no pasa cuota ({acumulado + preview.toneladas}/{cuota} ton) → $0
            </p>
          </div>
        )}
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Observaciones</label>
          <input value={obs} onChange={e => setObs(e.target.value)} placeholder="(opcional)"
            className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div className="flex items-end">
          <button onClick={guardar} disabled={loading || !empleadoId || !toneladas}
            className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-medium rounded-lg transition-colors">
            {loading ? '...' : 'Agregar'}
          </button>
        </div>
      </div>
      {registros.length > 0 && (
        <table className="w-full text-xs">
          <thead><tr className="text-slate-500">
            <th className="text-left pb-1">Empleado</th>
            <th className="text-right pb-1">Ton.</th>
            <th className="text-right pb-1">Importe</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-50">
            {registros.map((r: Record<string, unknown>) => {
              const emp = r.empleado as { nombre?: string } | null;
              const ton = Number(r.toneladas);
              const imp = Number(r.importe);
              const tonPag = Math.floor(imp / 30);
              return (
                <tr key={r.id as string} className="text-slate-700">
                  <td className="py-1">{emp?.nombre ?? '—'}</td>
                  <td className="py-1 text-right font-mono">{ton}</td>
                  <td className="py-1 text-right font-mono">
                    <span className="text-emerald-600 font-semibold">${imp}</span>
                    {tonPag > 0 && <span className="block text-[10px] text-slate-400">{tonPag} ton × $30</span>}
                    {imp === 0 && <span className="block text-[10px] text-slate-400">bajo cuota</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Sección genérica de bonos por empleado
function SeccionBonoEmpleado({ titulo, periodoId, fecha, empleados, registros, tabla, fields, calcular, columnas }: {
  titulo: string;
  periodoId: string;
  fecha: string;
  empleados: Empleado[];
  registros: Record<string, unknown>[];
  tabla: string;
  fields: { key: string; label: string; type: 'number' | 'select'; options?: { value: string; label: string }[] }[];
  calcular: (vals: Record<string, number | string>) => Record<string, number | boolean>;
  columnas: { key: string; label: string }[];
}) {
  const router = useRouter();
  const [empleadoId, setEmpleadoId] = useState('');
  const [vals, setVals] = useState<Record<string, string>>({});
  const [obs, setObs] = useState('');
  const [loading, setLoading] = useState(false);

  const guardar = async () => {
    if (!empleadoId) return;
    setLoading(true);
    const numVals: Record<string, number | string> = {};
    fields.forEach(f => { numVals[f.key] = f.type === 'number' ? parseFloat(vals[f.key] ?? '0') : vals[f.key] ?? ''; });
    const calculado = calcular(numVals);
    const supabase = createClient();
    await supabase.from(tabla).insert({
      periodo_id: periodoId,
      fecha,
      empleado_id: empleadoId,
      ...numVals,
      ...calculado,
      observaciones: obs || null,
    });
    setEmpleadoId(''); setVals({}); setObs('');
    router.refresh();
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <h3 className="text-sm font-bold text-slate-700 mb-3">{titulo}</h3>
      <div className="flex flex-wrap gap-3 mb-3">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Empleado</label>
          <select value={empleadoId} onChange={e => setEmpleadoId(e.target.value)}
            className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">— Seleccionar —</option>
            {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>
        {fields.map(f => (
          <div key={f.key}>
            <label className="text-xs text-slate-500 mb-1 block">{f.label}</label>
            {f.type === 'select' ? (
              <select value={vals[f.key] ?? ''} onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))}
                className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="">— Tipo —</option>
                {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input type="number" min="0" step="any" value={vals[f.key] ?? ''} onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))}
                placeholder="0"
                className="w-28 px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            )}
          </div>
        ))}
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Observaciones</label>
          <input value={obs} onChange={e => setObs(e.target.value)} placeholder="(opcional)"
            className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div className="flex items-end">
          <button onClick={guardar} disabled={loading || !empleadoId}
            className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-medium rounded-lg transition-colors">
            {loading ? '...' : 'Agregar'}
          </button>
        </div>
      </div>
      {registros.length > 0 && (
        <table className="w-full text-xs">
          <thead><tr className="text-slate-500">
            <th className="text-left pb-1">Empleado</th>
            {columnas.map(c => <th key={c.key} className="text-right pb-1">{c.label}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-slate-50">
            {registros.map((r: Record<string, unknown>) => {
              const emp = r.empleado as { nombre?: string } | null;
              return (
                <tr key={r.id as string} className="text-slate-700">
                  <td className="py-1">{emp?.nombre ?? '—'}</td>
                  {columnas.map(c => (
                    <td key={c.key} className="py-1 text-right font-mono">
                      {c.key === 'importe' ? <span className="text-emerald-600 font-semibold">${r[c.key] as number}</span> : String(r[c.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Sección observaciones / producción extra
function SeccionExtra({ periodoId, fecha, empleados, registros }: {
  periodoId: string; fecha: string; empleados: Empleado[]; registros: Record<string, unknown>[];
}) {
  const router = useRouter();
  const [empleadoId, setEmpleadoId] = useState('');
  const [concepto, setConcepto] = useState('');
  const [importe, setImporte] = useState('');
  const [obs, setObs] = useState('');
  const [loading, setLoading] = useState(false);

  const guardar = async () => {
    if (!empleadoId || !concepto) return;
    setLoading(true);
    const supabase = createClient();
    await supabase.from('produccion_extra').insert({
      periodo_id: periodoId,
      fecha,
      empleado_id: empleadoId,
      concepto,
      importe: parseFloat(importe || '0'),
      observaciones: obs || null,
    });
    setEmpleadoId(''); setConcepto(''); setImporte(''); setObs('');
    router.refresh();
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <h3 className="text-sm font-bold text-slate-700 mb-3">📝 Extra / Observaciones</h3>
      <div className="flex flex-wrap gap-3 mb-3">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Empleado</label>
          <select value={empleadoId} onChange={e => setEmpleadoId(e.target.value)}
            className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">— Seleccionar —</option>
            {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Concepto</label>
          <input value={concepto} onChange={e => setConcepto(e.target.value)} placeholder="Descripción"
            className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Importe ($)</label>
          <input type="number" min="0" step="any" value={importe} onChange={e => setImporte(e.target.value)} placeholder="0"
            className="w-24 px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Observaciones</label>
          <input value={obs} onChange={e => setObs(e.target.value)} placeholder="(opcional)"
            className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div className="flex items-end">
          <button onClick={guardar} disabled={loading || !empleadoId || !concepto}
            className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-medium rounded-lg transition-colors">
            {loading ? '...' : 'Agregar'}
          </button>
        </div>
      </div>
      {registros.length > 0 && (
        <table className="w-full text-xs">
          <thead><tr className="text-slate-500"><th className="text-left pb-1">Empleado</th><th className="text-left pb-1">Concepto</th><th className="text-right pb-1">Importe</th></tr></thead>
          <tbody className="divide-y divide-slate-50">
            {registros.map((r: Record<string, unknown>) => {
              const emp = r.empleado as { nombre?: string } | null;
              return (
                <tr key={r.id as string} className="text-slate-700">
                  <td className="py-1">{emp?.nombre ?? '—'}</td>
                  <td className="py-1">{String(r.concepto)}</td>
                  <td className="py-1 text-right text-emerald-600 font-semibold">${r.importe as number}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Componente principal
export default function BitacoraClient({
  periodos, periodoActivo, empleados, dias, fechasDisponibles, fechaSeleccionada,
  totalesPorDia, filasResumen, maxCelda, vistaActiva, soloLectura,
  embarques, doblados, enderezados, anillos, descargas, extras,
}: Props) {
  const router = useRouter();

  const ir = (params: { fecha?: string; vista?: string; periodo?: string }) => {
    const p = new URLSearchParams();
    p.set('periodo', params.periodo ?? periodoActivo.id);
    if (params.vista) p.set('vista', params.vista);
    if (params.fecha) p.set('fecha', params.fecha);
    router.push(`/dashboard/bitacora?${p.toString()}`);
  };

  const totalSemana = Object.values(totalesPorDia).reduce((s, v) => s + v, 0);
  const totalDia = totalesPorDia[fechaSeleccionada] ?? 0;

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Bitácora semanal</h1>
          <p className="text-sm text-slate-500 mt-1">
            {fmtDia(periodoActivo.fecha_inicio, 'long')} → {fmtDia(periodoActivo.fecha_fin, 'long')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={periodoActivo.id}
            onChange={e => ir({ periodo: e.target.value, vista: vistaActiva })}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {periodos.map(p => (
              <option key={p.id} value={p.id}>
                {new Date(p.fecha_inicio + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                {' – '}
                {new Date(p.fecha_fin + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                {p.estado === 'abierto' ? ' (abierto)' : ' (cerrado)'}
              </option>
            ))}
          </select>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            soloLectura ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-700'
          }`}>
            {soloLectura ? 'Cerrado' : 'Abierto'}
          </span>
        </div>
      </div>

      {soloLectura && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Periodo cerrado — solo consulta. Los totales provienen de los registros importados.
        </div>
      )}

      {/* Stats rápidos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total semana', value: fmtMoney(totalSemana), color: 'text-emerald-800 bg-emerald-50 border-emerald-200' },
          { label: 'Día seleccionado', value: fmtMoney(totalDia), color: 'text-blue-800 bg-blue-50 border-blue-200' },
          { label: 'Empleados c/bono', value: String(filasResumen.filter(f => f.total > 0).length), color: 'text-slate-800 bg-white border-slate-200' },
          { label: 'Días laborales', value: String(fechasDisponibles.length), color: 'text-slate-800 bg-white border-slate-200' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.color}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{s.label}</p>
            <p className="text-xl font-bold mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Mosaico calendario */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Calendario de la semana</p>
        <SemanaMosaico
          dias={dias}
          totalesPorDia={totalesPorDia}
          seleccionada={fechaSeleccionada}
          onSelect={f => ir({ fecha: f, vista: 'dia' })}
        />
      </div>

      {/* Tabs vista */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {(['semana', 'dia'] as const).map(v => (
          <button
            key={v}
            type="button"
            onClick={() => ir({ vista: v, fecha: fechaSeleccionada })}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              vistaActiva === v ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {v === 'semana' ? 'Resumen semanal' : `Detalle · ${fmtDia(fechaSeleccionada)}`}
          </button>
        ))}
      </div>

      {vistaActiva === 'semana' ? (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Producción por empleado (como Excel desglosado)
          </p>
          <ResumenSemanaGrid dias={dias} filas={filasResumen} totalesPorDia={totalesPorDia} maxCelda={maxCelda} />
        </div>
      ) : (
        <div className="space-y-5">
          {!soloLectura && (
            <>
              <SeccionEmbarques periodoId={periodoActivo.id} fecha={fechaSeleccionada} empleados={empleados} registros={embarques} />
              <SeccionDoblado periodoId={periodoActivo.id} fecha={fechaSeleccionada} empleados={empleados} registros={doblados} />
              <SeccionBonoEmpleado
                titulo="⚙️ Enderezado — $50/persona (>330 kg)"
                periodoId={periodoActivo.id} fecha={fechaSeleccionada} empleados={empleados} registros={enderezados}
                tabla="bonos_enderezado"
                fields={[{ key: 'kilos', label: 'Kilos procesados', type: 'number' }]}
                calcular={v => calcularEnderezado(Number(v.kilos))}
                columnas={[{ key: 'kilos', label: 'Kg' }, { key: 'importe', label: 'Importe' }]}
              />
              <SeccionBonoEmpleado
                titulo="⭕ Anillos — $0.50/kg"
                periodoId={periodoActivo.id} fecha={fechaSeleccionada} empleados={empleados} registros={anillos}
                tabla="bonos_anillos"
                fields={[{ key: 'kilos', label: 'Kilos', type: 'number' }]}
                calcular={v => ({ importe: calcularAnillos(Number(v.kilos)) })}
                columnas={[{ key: 'kilos', label: 'Kg' }, { key: 'importe', label: 'Importe' }]}
              />
              <SeccionBonoEmpleado
                titulo="📦 Descargas"
                periodoId={periodoActivo.id} fecha={fechaSeleccionada} empleados={empleados} registros={descargas}
                tabla="bonos_descargas"
                fields={[{
                  key: 'tipo_vehiculo', label: 'Tipo vehículo', type: 'select',
                  options: [{ value: 'trailer', label: 'Tráiler ($25)' }, { value: 'rabon', label: 'Rabón ($20)' }, { value: 'camioneta', label: 'Camioneta ($15)' }],
                }]}
                calcular={v => ({ importe: calcularDescarga(v.tipo_vehiculo as TipoVehiculo) })}
                columnas={[{ key: 'tipo_vehiculo', label: 'Vehículo' }, { key: 'importe', label: 'Importe' }]}
              />
              <SeccionExtra periodoId={periodoActivo.id} fecha={fechaSeleccionada} empleados={empleados} registros={extras} />
            </>
          )}

          <div>
            <h3 className="text-sm font-bold text-slate-700 mb-3">
              Registros del día · {fmtDia(fechaSeleccionada, 'long')}
            </h3>
            <SeccionRegistrosDia extras={extras} embarques={embarques} doblados={doblados} enderezados={enderezados} anillos={anillos} descargas={descargas} />
          </div>
        </div>
      )}
    </div>
  );
}

function SeccionRegistrosDia({ extras, embarques, doblados, enderezados, anillos, descargas }: {
  extras: Record<string, unknown>[];
  embarques: Record<string, unknown>[];
  doblados: Record<string, unknown>[];
  enderezados: Record<string, unknown>[];
  anillos: Record<string, unknown>[];
  descargas: Record<string, unknown>[];
}) {
  type Item = { id: string; empleado: string; concepto: string; detalle: string; importe: number };

  const items: Item[] = [];

  extras.forEach(r => {
    const emp = r.empleado as { nombre?: string } | null;
    items.push({
      id: r.id as string,
      empleado: emp?.nombre ?? '—',
      concepto: String(r.concepto),
      detalle: r.observaciones ? String(r.observaciones) : 'Producción / ajuste de nómina',
      importe: Number(r.importe),
    });
  });

  embarques.forEach(r => {
    const op = r.operador as { nombre?: string } | null;
    const ay1 = r.ayudante1 as { nombre?: string } | null;
    const ay2 = r.ayudante2 as { nombre?: string } | null;
    const partes = [
      op && `Operador ${op.nombre}: $${r.importe_operador}`,
      ay1 && `Ay.1 ${ay1.nombre}: $${r.importe_ayudante1}`,
      ay2 && `Ay.2 ${ay2.nombre}: $${r.importe_ayudante2}`,
    ].filter(Boolean);
    items.push({
      id: r.id as string,
      empleado: op?.nombre ?? '—',
      concepto: 'Embarque / vuelta',
      detalle: `${String(r.tipo_unidad)} · ${partes.join(' · ')}`,
      importe: Number(r.importe_operador) + Number(r.importe_ayudante1) + Number(r.importe_ayudante2),
    });
  });

  doblados.forEach(r => {
    const emp = r.empleado as { nombre?: string } | null;
    items.push({ id: r.id as string, empleado: emp?.nombre ?? '—', concepto: 'Doblado varilla', detalle: `${r.toneladas} ton (${Number(r.importe) > 0 ? `$${r.importe} sobre cuota` : 'bajo cuota'})`, importe: Number(r.importe) });
  });

  enderezados.forEach(r => {
    const emp = r.empleado as { nombre?: string } | null;
    items.push({ id: r.id as string, empleado: emp?.nombre ?? '—', concepto: 'Enderezado', detalle: `${r.kilos} kg${r.califica ? ' · meta >330 kg' : ''}`, importe: Number(r.importe) });
  });

  anillos.forEach(r => {
    const emp = r.empleado as { nombre?: string } | null;
    items.push({ id: r.id as string, empleado: emp?.nombre ?? '—', concepto: 'Anillos', detalle: `${r.kilos} kg × $0.50/kg`, importe: Number(r.importe) });
  });

  descargas.forEach(r => {
    const emp = r.empleado as { nombre?: string } | null;
    items.push({ id: r.id as string, empleado: emp?.nombre ?? '—', concepto: 'Descarga', detalle: String(r.tipo_vehiculo), importe: Number(r.importe) });
  });

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-400 text-sm">
        Sin registros para este día.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
          <tr>
            <th className="text-left px-4 py-2 font-semibold">Empleado</th>
            <th className="text-left px-4 py-2 font-semibold">Concepto</th>
            <th className="text-left px-4 py-2 font-semibold">Detalle</th>
            <th className="text-right px-4 py-2 font-semibold">Importe</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map(it => (
            <tr key={it.id} className="hover:bg-emerald-50/40">
              <td className="px-4 py-2.5 font-medium text-slate-800">{it.empleado}</td>
              <td className="px-4 py-2.5 text-emerald-800 font-medium">{it.concepto}</td>
              <td className="px-4 py-2.5 text-slate-500 text-xs">{it.detalle}</td>
              <td className={`px-4 py-2.5 text-right font-mono font-semibold tabular-nums ${it.importe < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                {fmtNomina(it.importe)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
