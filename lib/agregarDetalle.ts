import { columnaDeConcepto, type CeldaDetalle, type DetalleNomina, type LineaDetalle, type MontosNomina, detalleVacio, montosVacios } from './nomina';

export function crearCeldaMap() {
  return {} as Record<string, Record<string, CeldaDetalle>>;
}

export function agregarLinea(
  map: Record<string, Record<string, CeldaDetalle>>,
  empId: string,
  fecha: string,
  linea: LineaDetalle,
) {
  if (!map[empId]) map[empId] = {};
  if (!map[empId][fecha]) map[empId][fecha] = { total: 0, lineas: [] };
  map[empId][fecha].lineas.push(linea);
  map[empId][fecha].total += linea.importe;
}

export function agregarExtra(
  map: Record<string, Record<string, CeldaDetalle>>,
  nomMontos: Record<string, MontosNomina>,
  nomDetalle: Record<string, DetalleNomina>,
  empId: string,
  fecha: string,
  concepto: string,
  importe: number,
  observaciones?: string | null,
  registroId?: string,
) {
  const col = columnaDeConcepto(concepto);
  const linea: LineaDetalle = {
    concepto,
    importe,
    fecha,
    detalle: observaciones ?? undefined,
    registroId,
    tabla: registroId ? 'produccion_extra' : undefined,
  };
  agregarLinea(map, empId, fecha, linea);

  if (!nomMontos[empId]) nomMontos[empId] = montosVacios();
  if (!nomDetalle[empId]) nomDetalle[empId] = detalleVacio();
  nomMontos[empId][col] += importe;
  nomDetalle[empId][col].push(linea);
}

export function agregarProduccion(
  map: Record<string, Record<string, CeldaDetalle>>,
  nomMontos: Record<string, MontosNomina>,
  nomDetalle: Record<string, DetalleNomina>,
  empId: string,
  fecha: string,
  concepto: string,
  importe: number,
  detalle: string,
  meta?: { registroId: string; tabla: string; campoEmbarque?: LineaDetalle['campoEmbarque'] },
) {
  const col = columnaDeConcepto(concepto);
  const linea: LineaDetalle = {
    concepto,
    importe,
    fecha,
    detalle,
    registroId: meta?.registroId,
    tabla: meta?.tabla,
    campoEmbarque: meta?.campoEmbarque,
  };
  agregarLinea(map, empId, fecha, linea);

  if (!nomMontos[empId]) nomMontos[empId] = montosVacios();
  if (!nomDetalle[empId]) nomDetalle[empId] = detalleVacio();
  if (col === 'produccion') {
    nomMontos[empId].produccion += importe;
  } else {
    nomMontos[empId][col] += importe;
  }
  nomDetalle[empId][col].push(linea);
}
