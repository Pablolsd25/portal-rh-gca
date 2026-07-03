import { createClient } from '@/lib/supabase/server';
import AbrirPeriodoBtn from './AbrirPeriodoBtn';
import CerrarPeriodoBtn from './CerrarPeriodoBtn';
import Link from 'next/link';

function proximoViernes(): string {
  const hoy = new Date();
  const dia = hoy.getDay(); // 0=dom, 5=vie
  const diasHastaViernes = (5 - dia + 7) % 7 || 7;
  const viernes = new Date(hoy);
  viernes.setDate(hoy.getDate() + diasHastaViernes);
  return viernes.toISOString().split('T')[0];
}

export default async function PeriodosPage() {
  const supabase = await createClient();
  const { data: periodos } = await supabase
    .from('periodos_nomina')
    .select('*, creado_por_user:staff_users!periodos_nomina_creado_por_fkey(full_name)')
    .order('fecha_inicio', { ascending: false });

  const hayPeriodoAbierto = periodos?.some(p => p.estado === 'abierto');
  const fechaInicioSugerida = proximoViernes();
  const fechaFinSugerida = new Date(new Date(fechaInicioSugerida).getTime() + 6 * 86400000).toISOString().split('T')[0];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Periodos de nómina</h1>
        {!hayPeriodoAbierto && (
          <AbrirPeriodoBtn fechaInicio={fechaInicioSugerida} fechaFin={fechaFinSugerida} />
        )}
      </div>

      {hayPeriodoAbierto && (
        <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800 flex items-center justify-between">
          <span>Hay un periodo <strong>abierto</strong>. Ciérralo antes de abrir uno nuevo.</span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Inicio (viernes)</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Fin (jueves)</th>
              <th className="text-center px-4 py-3 font-semibold text-slate-600">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(!periodos || periodos.length === 0) && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">No hay periodos registrados.</td>
              </tr>
            )}
            {periodos?.map(p => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">
                  {new Date(p.fecha_inicio + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {new Date(p.fecha_fin + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    p.estado === 'abierto' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {p.estado}
                  </span>
                </td>
                <td className="px-4 py-3 text-right flex items-center justify-end gap-3">
                  <Link href={`/dashboard/bitacora?periodo=${p.id}`} className="text-xs text-blue-600 hover:underline">
                    Bitácora
                  </Link>
                  <Link href={`/dashboard/nomina?periodo=${p.id}`} className="text-xs text-emerald-600 hover:underline">
                    Nómina
                  </Link>
                  {p.estado === 'abierto' && <CerrarPeriodoBtn periodoId={p.id} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
