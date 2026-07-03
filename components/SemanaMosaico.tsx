'use client';

import { fmtDia, fmtMoney, heatLevel, type DiaSemana } from '@/lib/semana';

interface Props {
  dias: DiaSemana[];
  totalesPorDia: Record<string, number>;
  seleccionada: string;
  onSelect: (iso: string) => void;
  maxTotal?: number;
}

const DIA_LABEL = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function SemanaMosaico({ dias, totalesPorDia, seleccionada, onSelect, maxTotal }: Props) {
  const max = maxTotal ?? Math.max(...Object.values(totalesPorDia), 1);

  return (
    <div className="grid grid-cols-7 gap-2">
      {dias.map(d => {
        const total = totalesPorDia[d.iso] ?? 0;
        const activo = d.iso === seleccionada;
        const level = heatLevel(total, max);
        const bg = d.esLaboral
          ? `rgba(5, 150, 105, ${0.08 + level * 0.55})`
          : 'rgba(148, 163, 184, 0.12)';

        return (
          <button
            key={d.iso}
            type="button"
            onClick={() => d.esLaboral && onSelect(d.iso)}
            disabled={!d.esLaboral}
            style={{ backgroundColor: bg }}
            className={`relative rounded-xl border p-3 text-left transition-all ${
              activo
                ? 'border-emerald-600 ring-2 ring-emerald-400 shadow-md scale-[1.02]'
                : d.esLaboral
                  ? 'border-emerald-200/80 hover:border-emerald-400 hover:shadow-sm'
                  : 'border-slate-200 opacity-60 cursor-not-allowed'
            }`}
          >
            {d.esCorte && (
              <span className="absolute top-1.5 right-1.5 text-[9px] font-bold uppercase tracking-wide text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                Corte
              </span>
            )}
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {DIA_LABEL[d.diaSemana]}
            </p>
            <p className="text-lg font-bold text-slate-800 leading-tight">
              {new Date(d.iso + 'T00:00:00').getDate()}
            </p>
            <p className="text-[10px] text-slate-500 truncate">{fmtDia(d.iso).split(',')[1]?.trim()}</p>
            {d.esLaboral ? (
              <p className={`mt-2 text-sm font-bold tabular-nums ${total > 0 ? 'text-emerald-800' : 'text-slate-300'}`}>
                {total > 0 ? fmtMoney(total) : '—'}
              </p>
            ) : (
              <p className="mt-2 text-[10px] text-slate-400 italic">Descanso</p>
            )}
          </button>
        );
      })}
    </div>
  );
}
