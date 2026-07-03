// Reglas de negocio de nómina — fuente única de verdad

export type TipoUnidad = 'freightliner' | 'isuzu' | 'ford';
export type TipoVehiculo = 'trailer' | 'rabon' | 'camioneta';

export function calcularVuelta(tipo: TipoUnidad): { operador: number; ayudante: number } {
  if (tipo === 'freightliner' || tipo === 'isuzu') return { operador: 80, ayudante: 40 };
  return { operador: 50, ayudante: 25 }; // ford
}

export function cuotaDoblado(fecha: string): number {
  const dia = new Date(fecha + 'T00:00:00').getDay(); // 0=dom … 6=sáb
  if (dia === 6) return 10;
  if (dia === 0) return 16; // domingo no laboral; misma cuota por defecto
  return 16; // lun–vie
}

/** Toneladas enteras que pagan $30 después de cubrir la cuota del día */
export function toneladasPagablesDoblado(totalTon: number, cuota: number): number {
  return Math.max(0, Math.floor(totalTon) - cuota);
}

/** acumuladoDia = toneladas ya registradas ese día para el mismo empleado */
export function calcularDoblado(
  toneladas: number,
  fecha: string,
  acumuladoDia = 0,
): { toneladas: number; importe: number; tonPagables: number } {
  const cuota = cuotaDoblado(fecha);
  const tonEnteras = Math.floor(toneladas);
  const pagablesAntes = toneladasPagablesDoblado(acumuladoDia, cuota);
  const pagablesDespues = toneladasPagablesDoblado(acumuladoDia + tonEnteras, cuota);
  const tonPagables = pagablesDespues - pagablesAntes;
  return { toneladas: tonEnteras, importe: tonPagables * 30, tonPagables };
}

export function calcularEnderezado(kilos: number): { califica: boolean; importe: number } {
  const califica = kilos > 330;
  return { califica, importe: califica ? 50 : 0 };
}

export function calcularAnillos(kilos: number): number {
  return kilos * 0.5;
}

export function calcularDescarga(tipo: TipoVehiculo): number {
  const tarifas: Record<TipoVehiculo, number> = { trailer: 25, rabon: 20, camioneta: 15 };
  return tarifas[tipo];
}
