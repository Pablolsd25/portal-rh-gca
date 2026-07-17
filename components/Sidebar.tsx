'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { tituloPortal } from '@/lib/auth';
import NotificationBell from '@/components/notifications/NotificationBell';

type Role =
  | 'admin'
  | 'rh'
  | 'logistica'
  | 'vendedor'
  | 'venta mostrador'
  | 'contabilidad';

type NavItem = {
  href: string;
  label: string;
  roles: Role[];
  icon: React.ReactNode;
  section?: string;
};

const icon = (d: string) => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
  </svg>
);

const navItems: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Inicio',
    roles: ['admin', 'rh', 'vendedor', 'venta mostrador', 'contabilidad'],
    section: 'General',
    icon: icon('M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'),
  },
  {
    href: '/dashboard/aprobacion-pagos',
    label: 'Aprobación pagos',
    roles: ['admin'],
    section: 'Gestión',
    icon: icon('M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'),
  },
  {
    href: '/dashboard/cotizaciones',
    label: 'Cotizaciones',
    roles: ['admin'],
    section: 'Gestión',
    icon: icon('M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'),
  },
  {
    href: '/dashboard/creditos',
    label: 'Créditos',
    roles: ['admin', 'vendedor', 'venta mostrador'],
    section: 'Gestión',
    icon: icon('M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z'),
  },
  {
    href: '/dashboard/clientes',
    label: 'Clientes',
    roles: ['admin', 'vendedor', 'venta mostrador'],
    section: 'Gestión',
    icon: icon('M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z'),
  },
  {
    href: '/dashboard/contabilidad',
    label: 'Contabilidad PPD',
    roles: ['admin', 'contabilidad'],
    section: 'Gestión',
    icon: icon('M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z'),
  },
  {
    href: '/dashboard/reporte-ventas',
    label: 'Reporte ventas',
    roles: ['admin'],
    section: 'Gestión',
    icon: icon('M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'),
  },
  {
    href: '/dashboard/admin-reporte-precios',
    label: 'Análisis precios',
    roles: ['admin'],
    section: 'Gestión',
    icon: icon('M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z'),
  },
  {
    href: '/dashboard/cotizaciones',
    label: 'Cotizaciones',
    roles: ['vendedor', 'venta mostrador'],
    section: 'Ventas',
    icon: icon('M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'),
  },
  {
    href: '/dashboard/cotizador',
    label: 'Nueva cotización',
    roles: ['vendedor', 'venta mostrador'],
    section: 'Ventas',
    icon: icon('M12 4v16m8-8H4'),
  },
  {
    href: '/dashboard/venta-mostrador',
    label: 'Venta mostrador',
    roles: ['venta mostrador'],
    section: 'Ventas',
    icon: icon('M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z'),
  },
  {
    href: '/dashboard/caja-mostrador',
    label: 'Caja mostrador',
    roles: ['venta mostrador'],
    section: 'Ventas',
    icon: icon('M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z'),
  },
  {
    href: '/dashboard/prospectos',
    label: 'Prospectos',
    roles: ['vendedor', 'venta mostrador', 'admin'],
    section: 'Ventas',
    icon: icon('M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z'),
  },
  {
    href: '/dashboard/bitacora-comercial',
    label: 'Bitácora comercial',
    roles: ['vendedor', 'venta mostrador', 'admin'],
    section: 'Ventas',
    icon: icon('M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'),
  },
  {
    href: '/dashboard/clientes-frecuentes',
    label: 'Clientes frecuentes',
    roles: ['vendedor', 'venta mostrador', 'admin'],
    section: 'Ventas',
    icon: icon('M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z'),
  },
  {
    href: '/dashboard/reporte-precios',
    label: 'Reporte precios',
    roles: ['vendedor', 'venta mostrador', 'admin'],
    section: 'Ventas',
    icon: icon('M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z'),
  },
  {
    href: '/dashboard/reporte-ventas-vendedor',
    label: 'Mi reporte semanal',
    roles: ['vendedor'],
    section: 'Ventas',
    icon: icon('M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'),
  },
  {
    href: '/dashboard/lista-precios',
    label: 'Lista de precios',
    roles: ['vendedor', 'venta mostrador'],
    section: 'Ventas',
    icon: icon('M9 7h6m-6 4h6m-6 4h4M7 3h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z'),
  },
  {
    href: '/dashboard/rutas',
    label: 'Rutas / Báscula',
    roles: ['admin', 'rh', 'logistica'],
    section: 'Operaciones',
    icon: icon('M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7'),
  },
  {
    href: '/dashboard/inventario',
    label: 'Inventario',
    roles: ['admin', 'rh'],
    section: 'Operaciones',
    icon: icon('M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4'),
  },
  {
    href: '/dashboard/lista-precios',
    label: 'Lista de precios',
    roles: ['admin', 'rh'],
    section: 'Operaciones',
    icon: icon('M9 7h6m-6 4h6m-6 4h4M7 3h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z'),
  },
  {
    href: '/dashboard/empleados',
    label: 'Empleados',
    roles: ['admin', 'rh'],
    section: 'RH',
    icon: icon('M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z'),
  },
  {
    href: '/dashboard/periodos',
    label: 'Periodos',
    roles: ['admin', 'rh'],
    section: 'RH',
    icon: icon('M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'),
  },
  {
    href: '/dashboard/bitacora',
    label: 'Bitácora embarques',
    roles: ['admin', 'rh'],
    section: 'RH',
    icon: icon('M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01'),
  },
  {
    href: '/dashboard/nomina',
    label: 'Nómina',
    roles: ['admin', 'rh'],
    section: 'RH',
    icon: icon('M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z'),
  },
];

export default function Sidebar({ userName, userRole }: { userName: string; userRole: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const role = userRole as Role;
  const items = navItems.filter(item => item.roles.includes(role));
  const titulo = tituloPortal(userRole);
  const sections = Array.from(new Set(items.map(i => i.section).filter(Boolean))) as string[];
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const renderItem = (item: NavItem) => {
    const isActive =
      pathname === item.href ||
      (item.href !== '/dashboard' && pathname.startsWith(item.href));
    return (
      <Link
        key={`${item.href}-${item.label}-${item.section}`}
        href={item.href}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-emerald-700 text-white'
            : 'text-slate-300 hover:bg-slate-700 hover:text-white'
        }`}
      >
        {item.icon}
        {item.label}
      </Link>
    );
  };

  const aside = (
    <aside className="w-64 bg-slate-800 text-white flex flex-col h-full">
      <div className="px-6 py-5 border-b border-slate-700 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Portal GCA</p>
          <p className="text-sm font-bold text-white mt-0.5">Grupo Castro Acero</p>
          <p className="text-[11px] text-slate-400 mt-1">{titulo}</p>
        </div>
        <NotificationBell />
      </div>

      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        {sections.map(section => (
          <div key={section}>
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {section}
            </p>
            <div className="space-y-1">{items.filter(i => i.section === section).map(renderItem)}</div>
          </div>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-slate-700">
        <div className="px-3 py-2 mb-2">
          <p className="text-xs text-slate-400">Sesión activa</p>
          <p className="text-sm text-white font-medium truncate">{userName}</p>
          <p className="text-[11px] text-slate-500 capitalize">{userRole}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
        >
          {icon('M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1')}
          Cerrar sesión
        </button>
      </div>
    </aside>
  );

  return (
    <>
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-slate-800 border-b border-slate-700 px-3 py-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="p-2 rounded-lg text-slate-200 hover:bg-slate-700"
          aria-label="Abrir menú"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <p className="text-sm font-semibold text-white">Portal GCA</p>
        <NotificationBell />
      </div>

      <div className="hidden md:flex h-full">{aside}</div>

      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative z-10 h-full">{aside}</div>
        </div>
      )}
    </>
  );
}
