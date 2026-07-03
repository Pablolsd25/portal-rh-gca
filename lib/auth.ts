export const ROLES_PORTAL = ['rh', 'admin', 'logistica'] as const;
export const ROLES_RH = ['rh', 'admin'] as const;

export type PortalRole = (typeof ROLES_PORTAL)[number];

export function tieneAccesoPortal(role: string | undefined | null): role is PortalRole {
  const r = role?.trim().toLowerCase();
  return !!r && (ROLES_PORTAL as readonly string[]).includes(r);
}

export function puedeProgramarRuta(role: string | undefined | null): boolean {
  return !!role && (ROLES_RH as readonly string[]).includes(role);
}

export function rutaInicio(role: string | undefined | null): string {
  return role === 'logistica' ? '/dashboard/rutas' : '/dashboard';
}
