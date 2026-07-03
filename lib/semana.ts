export interface DiaSemana {
  iso: string;
  diaSemana: number; // 0=dom … 6=sáb
  esLaboral: boolean;
  esCorte: boolean;
}

export function fechasPeriodo(inicio: string, fin: string): DiaSemana[] {
  const out: DiaSemana[] = [];
  const cur = new Date(inicio + 'T00:00:00');
  const end = new Date(fin + 'T00:00:00');
  while (cur <= end) {
    const iso = cur.toISOString().split('T')[0];
    const diaSemana = cur.getDay();
    out.push({ iso, diaSemana, esLaboral: diaSemana !== 0, esCorte: iso === fin });
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function fmtDia(iso: string, style: 'short' | 'long' = 'short') {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-MX', {
    weekday: style === 'short' ? 'short' : 'long',
    day: '2-digit',
    month: style === 'short' ? 'short' : 'long',
  });
}

export function fmtMoney(n: number) {
  return '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/** Intensidad 0–1 para heatmap según monto vs máximo del periodo */
export function heatLevel(valor: number, maximo: number) {
  if (valor <= 0 || maximo <= 0) return 0;
  return Math.min(1, valor / maximo);
}
