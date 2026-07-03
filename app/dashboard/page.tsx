import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: periodos }, , { count: totalEmpleados }] = await Promise.all([
    supabase
      .from('periodos_nomina')
      .select('*')
      .order('fecha_inicio', { ascending: false })
      .limit(5),
    supabase
      .from('empleados')
      .select('id')
      .eq('activo', true),
    supabase
      .from('empleados')
      .select('*', { count: 'exact', head: true })
      .eq('activo', true),
  ]);

  const periodoAbierto = periodos?.find(p => p.estado === 'abierto');

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Dashboard</h1>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Empleados activos</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">{totalEmpleados ?? 0}</p>
          <Link href="/dashboard/empleados" className="text-xs text-emerald-600 hover:underline mt-2 inline-block">Ver empleados →</Link>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Periodo actual</p>
          {periodoAbierto ? (
            <>
              <p className="text-sm font-semibold text-emerald-700 mt-1">
                {new Date(periodoAbierto.fecha_inicio + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                {' — '}
                {new Date(periodoAbierto.fecha_fin + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
              <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>Abierto
              </span>
            </>
          ) : (
            <p className="text-sm text-slate-400 mt-1">Sin periodo abierto</p>
          )}
          <Link href="/dashboard/periodos" className="text-xs text-emerald-600 hover:underline mt-2 inline-block">Ver periodos →</Link>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Accesos rápidos</p>
          <div className="flex flex-col gap-1.5 mt-2">
            <Link href="/dashboard/bitacora" className="text-sm text-slate-700 hover:text-emerald-700 hover:underline">→ Capturar bitácora</Link>
            <Link href="/dashboard/nomina" className="text-sm text-slate-700 hover:text-emerald-700 hover:underline">→ Ver nómina semanal</Link>
            <Link href="/dashboard/empleados/nuevo" className="text-sm text-slate-700 hover:text-emerald-700 hover:underline">→ Registrar empleado</Link>
          </div>
        </div>
      </div>

      {/* Últimos periodos */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Últimos periodos</h2>
          <Link href="/dashboard/periodos" className="text-xs text-emerald-600 hover:underline">Ver todos</Link>
        </div>
        <div className="divide-y divide-slate-50">
          {(!periodos || periodos.length === 0) && (
            <p className="px-5 py-4 text-sm text-slate-400">No hay periodos registrados aún.</p>
          )}
          {periodos?.map(p => (
            <div key={p.id} className="px-5 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">
                  {new Date(p.fecha_inicio + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short' })}
                  {' al '}
                  {new Date(p.fecha_fin + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                p.estado === 'abierto'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-500'
              }`}>
                {p.estado}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
