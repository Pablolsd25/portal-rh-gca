'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import NotificationBell from '@/components/notifications/NotificationBell';
import {
  ArchiveBoxIcon,
  ArrowRightOnRectangleIcon,
  BanknotesIcon,
  Bars3Icon,
  BuildingStorefrontIcon,
  CalculatorIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  HomeIcon,
  QueueListIcon,
  StarIcon,
  TruckIcon,
  UsersIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

type Role = string;

type NavItem = {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavModule = {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
};

function linkClass(active: boolean, nested = false) {
  if (active) {
    return nested
      ? 'bg-gradient-to-r from-rose-700 to-rose-600 text-white shadow-lg shadow-rose-500/20'
      : 'bg-gradient-to-r from-rose-700 to-rose-600 text-white shadow-lg shadow-rose-500/30';
  }
  return nested
    ? 'text-rose-300 hover:bg-rose-800/30 hover:text-rose-100'
    : 'text-rose-200 hover:bg-rose-800/50 hover:text-white';
}

export default function Sidebar({
  userName,
  userRole,
  userEmail,
}: {
  userName: string;
  userRole: string;
  userEmail?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const role = userRole as Role;
  const [open, setOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    venta_mostrador: false,
    cotizador: false,
    creditos: false,
    reportes: false,
    operaciones: false,
    rh: false,
  });

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const modules: Record<string, NavModule> = {};

  if (role === 'admin') {
    modules.reportes = {
      title: 'Reportes & Métricas',
      icon: ChartBarIcon,
      items: [
        { path: '/dashboard/reporte-ventas', label: 'Reportes de Ventas', icon: DocumentTextIcon },
        {
          path: '/dashboard/admin-reporte-precios',
          label: 'Reportes de Precios',
          icon: CurrencyDollarIcon,
        },
      ],
    };
  }

  if (role === 'admin' || role === 'vendedor' || role === 'venta mostrador') {
    modules.cotizador = {
      title: 'Cotizador & Ventas',
      icon: CalculatorIcon,
      items: [
        { path: '/dashboard/cotizador', label: 'Nueva Cotización', icon: CalculatorIcon },
        { path: '/dashboard/cotizaciones', label: 'Mis Cotizaciones', icon: QueueListIcon },
        { path: '/dashboard/prospectos', label: 'Mis Prospectos', icon: UsersIcon },
        {
          path: '/dashboard/bitacora-comercial',
          label: 'Bitácora de Visitas',
          icon: ClipboardDocumentListIcon,
        },
        {
          path: '/dashboard/clientes-frecuentes',
          label: 'Clientes Frecuentes',
          icon: StarIcon,
        },
        {
          path: '/dashboard/reporte-precios',
          label: 'Reportar Precios',
          icon: CurrencyDollarIcon,
        },
        ...(role === 'vendedor'
          ? [
              {
                path: '/dashboard/reporte-ventas-vendedor',
                label: 'Mi Reporte Semanal',
                icon: ChartBarIcon,
              },
            ]
          : []),
        { path: '/dashboard/lista-precios', label: 'Lista de Precios', icon: DocumentTextIcon },
      ],
    };
  }

  if (role === 'admin' || role === 'venta mostrador') {
    modules.venta_mostrador = {
      title: 'Venta en Mostrador',
      icon: BuildingStorefrontIcon,
      items: [
        {
          path: '/dashboard/venta-mostrador',
          label: 'Punto de Venta',
          icon: BuildingStorefrontIcon,
        },
        { path: '/dashboard/caja-mostrador', label: 'Gestión de Caja', icon: BanknotesIcon },
      ],
    };
  }

  if (role === 'admin') {
    modules.creditos = {
      title: 'Gestión de Créditos',
      icon: BanknotesIcon,
      items: [
        { path: '/dashboard/creditos', label: 'Dashboard Créditos', icon: ChartBarIcon },
        { path: '/dashboard/clientes', label: 'Clientes', icon: UsersIcon },
        {
          path: '/dashboard/creditos?tab=activo',
          label: 'Créditos Activos',
          icon: BanknotesIcon,
        },
        {
          path: '/dashboard/creditos?tab=pendiente',
          label: 'Solicitudes Pendientes',
          icon: ClockIcon,
        },
      ],
    };
  }

  if (role === 'admin' || role === 'rh' || role === 'logistica') {
    modules.operaciones = {
      title: 'Operaciones',
      icon: TruckIcon,
      items: [
        { path: '/dashboard/rutas', label: 'Rutas / Báscula', icon: TruckIcon },
        ...(role === 'admin' || role === 'rh'
          ? [
              { path: '/dashboard/inventario', label: 'Inventario', icon: ArchiveBoxIcon },
              {
                path: '/dashboard/lista-precios',
                label: 'Lista de Precios',
                icon: DocumentTextIcon,
              },
            ]
          : []),
      ],
    };
  }

  if (role === 'admin' || role === 'rh') {
    modules.rh = {
      title: 'Recursos Humanos',
      icon: UsersIcon,
      items: [
        { path: '/dashboard/empleados', label: 'Empleados', icon: UsersIcon },
        { path: '/dashboard/periodos', label: 'Periodos', icon: ClockIcon },
        {
          path: '/dashboard/bitacora',
          label: 'Bitácora Embarques',
          icon: ClipboardDocumentListIcon,
        },
        { path: '/dashboard/nomina', label: 'Nómina', icon: DocumentTextIcon },
      ],
    };
  }

  const isActivePath = (path: string) => {
    const base = path.split('?')[0];
    if (base === '/dashboard') return pathname === '/dashboard';
    return pathname === base || pathname.startsWith(`${base}/`);
  };

  const isActiveSection = (items: NavItem[]) => items.some(i => isActivePath(i.path));

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const aside = (
    <div className="w-72 lg:w-60 xl:w-72 h-full bg-gradient-to-b from-rose-950 via-rose-900 to-rose-950 shadow-2xl flex flex-col">
      <div className="p-5 border-b border-rose-800/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 bg-gradient-to-br from-rose-700 via-rose-600 to-amber-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-black text-lg">GCA</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Portal Staff</h2>
              <p className="text-xs text-rose-300">Grupo Castro Acero</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="lg:hidden p-2 rounded-lg text-rose-300 hover:text-white hover:bg-rose-800/50"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="px-3 py-3 bg-rose-900/50 rounded-xl border border-rose-800/30">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-rose-700 to-rose-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">
                {userName?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{userName || 'Usuario'}</p>
              <p className="text-xs text-rose-300 truncate capitalize">{userRole}</p>
              {userEmail && <p className="text-[10px] text-rose-400 truncate">{userEmail}</p>}
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-rose-800/30">
            <p className="text-xs text-slate-400">
              {currentTime.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
              {' • '}
              {currentTime.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-2">
        {(role === 'admin' ||
          role === 'vendedor' ||
          role === 'venta mostrador' ||
          role === 'rh' ||
          role === 'contabilidad') && (
          <Link
            href="/dashboard"
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${linkClass(pathname === '/dashboard')}`}
          >
            <HomeIcon className="w-5 h-5 flex-shrink-0" />
            <span className="font-semibold text-sm">Panel Principal</span>
          </Link>
        )}

        {role === 'admin' && (
          <Link
            href="/dashboard/aprobacion-pagos"
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${linkClass(isActivePath('/dashboard/aprobacion-pagos'))}`}
          >
            <CheckCircleIcon className="w-5 h-5 flex-shrink-0" />
            <span className="font-semibold text-sm">Aprobación de Pagos</span>
          </Link>
        )}

        {(role === 'admin' || role === 'contabilidad') && (
          <Link
            href="/dashboard/contabilidad"
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${linkClass(isActivePath('/dashboard/contabilidad'))}`}
          >
            <ArchiveBoxIcon className="w-5 h-5 flex-shrink-0" />
            <span className="font-semibold text-sm">Complementos PPD</span>
          </Link>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-3 space-y-2 scrollbar-dark">
        {Object.entries(modules).map(([key, module]) => {
          const Icon = module.icon;
          const sectionActive = isActiveSection(module.items);
          return (
            <div key={key} className="space-y-1">
              <button
                type="button"
                onClick={() => toggleSection(key)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all duration-200 ${
                  sectionActive
                    ? 'bg-gradient-to-r from-rose-700/20 to-amber-600/20 text-rose-300 border border-rose-600/30'
                    : 'text-rose-200 hover:bg-rose-800/50 hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="font-semibold text-sm">{module.title}</span>
                </div>
                {openSections[key] ? (
                  <ChevronDownIcon className="w-4 h-4" />
                ) : (
                  <ChevronRightIcon className="w-4 h-4" />
                )}
              </button>
              {openSections[key] && (
                <div className="pl-3 space-y-1 mt-1">
                  {module.items.map(item => {
                    const ItemIcon = item.icon;
                    const active = isActivePath(item.path);
                    return (
                      <Link
                        key={item.path + item.label}
                        href={item.path}
                        className={`flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${linkClass(active, true)}`}
                      >
                        <ItemIcon className="w-4 h-4 flex-shrink-0" />
                        <span className="text-sm font-medium">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-rose-800/50 bg-rose-950/50">
        <div className="px-4 pt-4 pb-2 relative">
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-rose-900/50 hover:bg-rose-800/50 transition-colors">
            <div className="flex items-center space-x-3 flex-1">
              <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
                <span className="text-amber-400 text-xs font-semibold">🔔</span>
              </div>
              <span className="text-sm font-medium text-rose-200">Notificaciones</span>
            </div>
            <div className="relative z-50">
              <NotificationBell />
            </div>
          </div>
        </div>
        <div className="p-4">
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="w-full flex items-center justify-center space-x-3 px-4 py-3 rounded-xl bg-red-600/10 text-red-300 hover:bg-red-600/20 hover:text-red-200 transition-all duration-200 border border-red-600/20 hover:border-red-500/30"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
            <span className="font-semibold text-sm">Cerrar Sesión</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
            aria-label="Abrir menú"
          >
            <Bars3Icon className="w-6 h-6" />
          </button>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-rose-700 via-rose-600 to-amber-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">GCA</span>
            </div>
            <div className="text-sm font-bold text-gray-800">Portal Staff</div>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <div className="hidden lg:flex sticky top-0 h-screen flex-shrink-0">{aside}</div>

      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setOpen(false)}
          />
          <div className="fixed top-0 left-0 z-50 h-screen lg:hidden">{aside}</div>
        </>
      )}
    </>
  );
}
