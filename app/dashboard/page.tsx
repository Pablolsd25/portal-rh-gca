import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { normalizeRole } from '@/lib/auth';
import DashboardVentasClient from './DashboardVentasClient';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: staff } = await supabase
    .from('staff_users')
    .select('id, full_name, role')
    .eq('id', user!.id)
    .single();

  const role = normalizeRole(staff?.role);
  const isAdmin = role === 'admin';
  const showVentas = isAdmin || role === 'vendedor' || role === 'venta mostrador';
  const showRh = role === 'rh';
  const showContabilidad = role === 'contabilidad';
  const showLogistica = role === 'logistica';

  let totalEmpleados: number | null = null;
  let periodos: Array<{
    id: string;
    fecha_inicio: string;
    fecha_fin: string;
    estado: string;
  }> | null = null;
  let pendientesPago = 0;

  if (showRh) {
    const [periodosRes, empleadosRes] = await Promise.all([
      supabase
        .from('periodos_nomina')
        .select('*')
        .order('fecha_inicio', { ascending: false })
        .limit(5),
      supabase
        .from('empleados')
        .select('*', { count: 'exact', head: true })
        .eq('activo', true),
    ]);
    periodos = periodosRes.data;
    totalEmpleados = empleadosRes.count;
  }

  if (isAdmin) {
    const { count } = await supabase
      .from('quotes')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'en_revision_pago');
    pendientesPago = count ?? 0;
  }

  const periodoAbierto = periodos?.find(p => p.estado === 'abierto');

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">
          {isAdmin ? 'Panel de administración' : 'Dashboard'}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {isAdmin
            ? 'Supervisión y gestión · Portal GCA'
            : `Hola${staff?.full_name ? `, ${staff.full_name.split(' ')[0]}` : ''}`}
        </p>
      </div>

      {isAdmin && (
        <section className="mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Pagos por aprobar
              </p>
              <p className="text-3xl font-bold text-slate-800 mt-1">{pendientesPago}</p>
              <Link
                href="/dashboard/aprobacion-pagos"
                className="text-xs text-emerald-600 hover:underline mt-2 inline-block"
              >
                Ir a aprobación →
              </Link>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Reportes
              </p>
              <div className="flex flex-col gap-1.5 mt-2">
                <Link href="/dashboard/reporte-ventas" className="text-sm text-slate-700 hover:text-emerald-700 hover:underline">
                  → Reporte de ventas
                </Link>
                <Link href="/dashboard/admin-reporte-precios" className="text-sm text-slate-700 hover:text-emerald-700 hover:underline">
                  → Análisis de precios
                </Link>
                <Link href="/dashboard/contabilidad" className="text-sm text-slate-700 hover:text-emerald-700 hover:underline">
                  → Contabilidad PPD
                </Link>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Accesos de gestión
              </p>
              <div className="flex flex-col gap-1.5 mt-2">
                <Link href="/dashboard/cotizaciones" className="text-sm text-slate-700 hover:text-emerald-700 hover:underline">
                  → Cotizaciones
                </Link>
                <Link href="/dashboard/creditos" className="text-sm text-slate-700 hover:text-emerald-700 hover:underline">
                  → Créditos
                </Link>
                <Link href="/dashboard/rutas" className="text-sm text-slate-700 hover:text-emerald-700 hover:underline">
                  → Rutas / Báscula
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {showVentas && <DashboardVentasClient userId={user!.id} role={role} />}

      {showContabilidad && (
        <section className="mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Contabilidad
              </p>
              <p className="text-sm text-slate-600 mt-2">
                Complementos PPD, facturas y pagos pendientes de conciliar.
              </p>
              <Link
                href="/dashboard/contabilidad"
                className="text-xs text-emerald-600 hover:underline mt-3 inline-block"
              >
                Ir a Contabilidad PPD →
              </Link>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Accesos rápidos
              </p>
              <div className="flex flex-col gap-1.5 mt-2">
                <Link href="/dashboard/contabilidad" className="text-sm text-slate-700 hover:text-emerald-700 hover:underline">
                  → Complementos PPD
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {showLogistica && (
        <section className="mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Operación diaria
              </p>
              <p className="text-sm text-slate-600 mt-2">
                Revisión de báscula y programación de rutas de entrega.
              </p>
              <Link
                href="/dashboard/rutas"
                className="text-xs text-emerald-600 hover:underline mt-3 inline-block"
              >
                Ir a Rutas / Báscula →
              </Link>
            </div>
          </div>
        </section>
      )}

      {showRh && (
        <>
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Recursos humanos
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Empleados activos
                </p>
                <p className="text-3xl font-bold text-slate-800 mt-1">{totalEmpleados ?? 0}</p>
                <Link
                  href="/dashboard/empleados"
                  className="text-xs text-emerald-600 hover:underline mt-2 inline-block"
                >
                  Ver empleados →
                </Link>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Periodo actual
                </p>
                {periodoAbierto ? (
                  <>
                    <p className="text-sm font-semibold text-emerald-700 mt-1">
                      {new Date(periodoAbierto.fecha_inicio + 'T00:00:00').toLocaleDateString(
                        'es-MX',
                        { day: '2-digit', month: 'short' },
                      )}
                      {' — '}
                      {new Date(periodoAbierto.fecha_fin + 'T00:00:00').toLocaleDateString(
                        'es-MX',
                        { day: '2-digit', month: 'short', year: 'numeric' },
                      )}
                    </p>
                    <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full mt-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                      Abierto
                    </span>
                  </>
                ) : (
                  <p className="text-sm text-slate-400 mt-1">Sin periodo abierto</p>
                )}
                <Link
                  href="/dashboard/periodos"
                  className="text-xs text-emerald-600 hover:underline mt-2 inline-block"
                >
                  Ver periodos →
                </Link>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Accesos rápidos RH
                </p>
                <div className="flex flex-col gap-1.5 mt-2">
                  <Link
                    href="/dashboard/bitacora"
                    className="text-sm text-slate-700 hover:text-emerald-700 hover:underline"
                  >
                    → Capturar bitácora
                  </Link>
                  <Link
                    href="/dashboard/nomina"
                    className="text-sm text-slate-700 hover:text-emerald-700 hover:underline"
                  >
                    → Ver nómina semanal
                  </Link>
                  <Link
                    href="/dashboard/empleados/nuevo"
                    className="text-sm text-slate-700 hover:text-emerald-700 hover:underline"
                  >
                    → Registrar empleado
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Últimos periodos</h2>
              <Link href="/dashboard/periodos" className="text-xs text-emerald-600 hover:underline">
                Ver todos
              </Link>
            </div>
            <div className="divide-y divide-slate-50">
              {(!periodos || periodos.length === 0) && (
                <p className="px-5 py-4 text-sm text-slate-400">
                  No hay periodos registrados aún.
                </p>
              )}
              {periodos?.map(p => (
                <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      {new Date(p.fecha_inicio + 'T00:00:00').toLocaleDateString('es-MX', {
                        weekday: 'short',
                        day: '2-digit',
                        month: 'short',
                      })}
                      {' al '}
                      {new Date(p.fecha_fin + 'T00:00:00').toLocaleDateString('es-MX', {
                        weekday: 'short',
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      p.estado === 'abierto'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {p.estado}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {!showRh && !showVentas && !showContabilidad && !showLogistica && (
        <p className="text-sm text-slate-500">Usa el menú lateral para navegar.</p>
      )}
    </div>
  );
}
