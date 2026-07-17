/** Roles con acceso al Portal GCA (mismo staff_users que portal-staff). */
export const ROLES_PORTAL = [
  'admin',
  'rh',
  'logistica',
  'vendedor',
  'venta mostrador',
  'contabilidad',
] as const;

export const ROLES_RH = ['rh', 'admin'] as const;
export const ROLES_VENTAS = ['admin', 'vendedor', 'venta mostrador'] as const;
export const ROLES_MOSTRADOR = ['admin', 'venta mostrador'] as const;
export const ROLES_CREDITOS = ['admin', 'vendedor', 'venta mostrador'] as const;
export const ROLES_CONTABILIDAD = ['admin', 'contabilidad'] as const;
export const ROLES_APROBACION = ['admin'] as const;
export const ROLES_RUTAS = ['rh', 'admin', 'logistica'] as const;
export const ROLES_LISTA_PRECIOS_EDIT = ['rh', 'admin'] as const;
export const ROLES_LISTA_PRECIOS_READ = [
  'rh',
  'admin',
  'vendedor',
  'venta mostrador',
] as const;

export type PortalRole = (typeof ROLES_PORTAL)[number];

export function normalizeRole(role: string | undefined | null): string {
  return (role ?? '').trim().toLowerCase();
}

export function tieneAccesoPortal(role: string | undefined | null): role is PortalRole {
  const r = normalizeRole(role);
  return (ROLES_PORTAL as readonly string[]).includes(r);
}

export function puedeProgramarRuta(role: string | undefined | null): boolean {
  return (ROLES_RH as readonly string[]).includes(normalizeRole(role));
}

export function puedeEditarListaPrecios(role: string | undefined | null): boolean {
  return (ROLES_LISTA_PRECIOS_EDIT as readonly string[]).includes(normalizeRole(role));
}

export function puedeLeerListaPrecios(role: string | undefined | null): boolean {
  return (ROLES_LISTA_PRECIOS_READ as readonly string[]).includes(normalizeRole(role));
}

/** Home por rol */
export function rutaInicio(role: string | undefined | null): string {
  switch (normalizeRole(role)) {
    case 'logistica':
      return '/dashboard/rutas';
    case 'venta mostrador':
      return '/dashboard/venta-mostrador';
    case 'contabilidad':
      return '/dashboard/contabilidad';
    case 'vendedor':
      return '/dashboard/cotizaciones';
    case 'rh':
      return '/dashboard';
    case 'admin':
    default:
      return '/dashboard';
  }
}

export function tituloPortal(role: string | undefined | null): string {
  switch (normalizeRole(role)) {
    case 'logistica':
      return 'Logística';
    case 'rh':
      return 'Recursos Humanos';
    case 'contabilidad':
      return 'Contabilidad';
    case 'vendedor':
    case 'venta mostrador':
      return 'Ventas';
    case 'admin':
      return 'Administración';
    default:
      return 'Sistema integral';
  }
}

/**
 * Prefijos permitidos por rol.
 * Importante: `/dashboard` solo autoriza exactamente esa ruta (no todos los hijos).
 */
export function rutasPermitidas(role: string | undefined | null): string[] {
  switch (normalizeRole(role)) {
    case 'logistica':
      return ['/dashboard/rutas'];
    case 'contabilidad':
      return ['/dashboard', '/dashboard/contabilidad'];
    case 'vendedor':
      return [
        '/dashboard',
        '/dashboard/cotizaciones',
        '/dashboard/cotizador',
        '/dashboard/prospectos',
        '/dashboard/bitacora-comercial',
        '/dashboard/clientes-frecuentes',
        '/dashboard/reporte-precios',
        '/dashboard/reporte-ventas-vendedor',
        '/dashboard/creditos',
        '/dashboard/clientes',
        '/dashboard/lista-precios',
      ];
    case 'venta mostrador':
      return [
        '/dashboard',
        '/dashboard/venta-mostrador',
        '/dashboard/caja-mostrador',
        '/dashboard/cotizaciones',
        '/dashboard/cotizador',
        '/dashboard/prospectos',
        '/dashboard/bitacora-comercial',
        '/dashboard/clientes-frecuentes',
        '/dashboard/reporte-precios',
        '/dashboard/creditos',
        '/dashboard/clientes',
        '/dashboard/lista-precios',
      ];
    case 'rh':
      return [
        '/dashboard',
        '/dashboard/empleados',
        '/dashboard/periodos',
        '/dashboard/bitacora',
        '/dashboard/rutas',
        '/dashboard/inventario',
        '/dashboard/lista-precios',
        '/dashboard/nomina',
      ];
    case 'admin':
      return [
        '/dashboard',
        '/dashboard/aprobacion-pagos',
        '/dashboard/cotizaciones',
        '/dashboard/cotizador',
        '/dashboard/venta-mostrador',
        '/dashboard/caja-mostrador',
        '/dashboard/creditos',
        '/dashboard/clientes',
        '/dashboard/contabilidad',
        '/dashboard/reporte-ventas',
        '/dashboard/reporte-precios',
        '/dashboard/admin-reporte-precios',
        '/dashboard/prospectos',
        '/dashboard/bitacora-comercial',
        '/dashboard/clientes-frecuentes',
        '/dashboard/rutas',
        '/dashboard/inventario',
        '/dashboard/lista-precios',
        '/dashboard/empleados',
        '/dashboard/periodos',
        '/dashboard/bitacora',
        '/dashboard/nomina',
      ];
    default:
      return ['/dashboard'];
  }
}

/** true si el path está permitido para el rol */
export function puedeAccederRuta(role: string | undefined | null, pathname: string): boolean {
  if (!tieneAccesoPortal(role)) return false;
  const allowed = rutasPermitidas(role);
  const path = pathname.replace(/\/+$/, '') || '/';

  return allowed.some(prefix => {
    const p = prefix.replace(/\/+$/, '') || '/';
    // `/dashboard` solo coincide exactamente (evita abrir cualquier subruta)
    if (p === '/dashboard') return path === '/dashboard';
    return path === p || path.startsWith(`${p}/`);
  });
}

export function rolEnLista(
  role: string | undefined | null,
  lista: readonly string[],
): boolean {
  return lista.includes(normalizeRole(role));
}
