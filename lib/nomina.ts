/** Columnas alineadas al Excel de nómina semanal */
export const COLUMNAS_NOMINA = [
  { key: 'sueldo', label: 'Sueldo', tipo: 'base' as const },
  { key: 'bono', label: 'Bono', tipo: 'ingreso' as const },
  { key: 'tareas', label: 'Tareas', tipo: 'ingreso' as const },
  { key: 'hrsExt', label: 'Hrs ext', tipo: 'ingreso' as const },
  { key: 'segundasVentas', label: '2as vtas', tipo: 'ingreso' as const },
  { key: 'vacaciones', label: 'Vacaciones', tipo: 'ingreso' as const },
  { key: 'despensa', label: 'Despensa', tipo: 'ingreso' as const },
  { key: 'produccion', label: 'Producción', tipo: 'ingreso' as const },
  { key: 'pretLp', label: 'Pret LP', tipo: 'descuento' as const },
  { key: 'prestCp', label: 'Prest C.P.', tipo: 'descuento' as const },
  { key: 'infonavit', label: 'Infonavit', tipo: 'descuento' as const },
  { key: 'dNoTrab', label: 'D. no trab', tipo: 'descuento' as const },
] as const;

export type ColumnaNominaKey = typeof COLUMNAS_NOMINA[number]['key'];

/** Mapeo concepto en BD → columna Excel */
const CONCEPTO_A_COLUMNA: Record<string, ColumnaNominaKey> = {
  'Bono': 'bono',
  'Tareas': 'tareas',
  'Horas extra': 'hrsExt',
  '2as ventas': 'segundasVentas',
  'Vacaciones': 'vacaciones',
  'Despensa': 'despensa',
  'Préstamo LP': 'pretLp',
  'Préstamo C.P.': 'prestCp',
  'INFONAVIT': 'infonavit',
  'Días no trabajados': 'dNoTrab',
};

export interface LineaDetalle {
  concepto: string;
  importe: number;
  fecha?: string;
  detalle?: string;
  registroId?: string;
  tabla?: string;
  /** Solo embarques: qué rol borrar sin afectar al resto del viaje */
  campoEmbarque?: 'operador' | 'ayudante1' | 'ayudante2';
}

export interface CeldaDetalle {
  total: number;
  lineas: LineaDetalle[];
}

export type MontosNomina = Record<ColumnaNominaKey, number>;
export type DetalleNomina = Record<ColumnaNominaKey, LineaDetalle[]>;

export function montosVacios(): MontosNomina {
  return {
    sueldo: 0, bono: 0, tareas: 0, hrsExt: 0, segundasVentas: 0,
    vacaciones: 0, despensa: 0, produccion: 0,
    pretLp: 0, prestCp: 0, infonavit: 0, dNoTrab: 0,
  };
}

export function detalleVacio(): DetalleNomina {
  const d = {} as DetalleNomina;
  for (const c of COLUMNAS_NOMINA) d[c.key] = [];
  return d;
}

export function columnaDeConcepto(concepto: string): ColumnaNominaKey {
  return CONCEPTO_A_COLUMNA[concepto] ?? 'produccion';
}

/** Concepto BD para columnas de descuento (agregar desde nómina) */
export const CONCEPTO_POR_COLUMNA: Partial<Record<ColumnaNominaKey, string>> = {
  pretLp: 'Préstamo LP',
  prestCp: 'Préstamo C.P.',
  infonavit: 'INFONAVIT',
  dNoTrab: 'Días no trabajados',
};

export function totalIngresos(m: MontosNomina) {
  return m.sueldo + m.bono + m.tareas + m.hrsExt + m.segundasVentas
    + m.vacaciones + m.despensa + m.produccion;
}

export function totalDescuentos(m: MontosNomina) {
  return Math.abs(m.pretLp) + Math.abs(m.prestCp) + Math.abs(m.infonavit) + Math.abs(m.dNoTrab);
}

export function totalNeto(m: MontosNomina) {
  return totalIngresos(m) - totalDescuentos(m);
}

export function fmtNomina(n: number, vacio = '—') {
  if (n === 0) return vacio;
  return '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtFechaCorta(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short' });
}
