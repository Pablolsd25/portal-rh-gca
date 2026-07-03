'use client';

import { useState } from 'react';
import { fmtMoney, heatLevel, type DiaSemana } from '@/lib/semana';
import type { CeldaDetalle as CeldaDetalleType } from '@/lib/nomina';
import { fmtNomina, fmtFechaCorta } from '@/lib/nomina';

export interface FilaResumen {
  id: string;
  nombre: string;
  porDia: Record<string, number>;
  total: number;
  detallePorDia?: Record<string, CeldaDetalleType>;
}

interface Props {
  dias: DiaSemana[];
  filas: FilaResumen[];
  totalesPorDia: Record<string, number>;
  maxCelda: number;
}

const DIA_LABEL = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function CeldaDia({ valor, detalle, maxCelda, esCorte }: {
  valor: number;
  detalle?: CeldaDetalleType;
  maxCelda: number;
  esCorte: boolean;
}) {
  const [open, setOpen] = useState(false);
  const lvl = heatLevel(valor, maxCelda);

  if (valor <= 0) {
    return (
      <td className={`px-2 py-2 text-center text-slate-200 ${esCorte ? 'border-l border-r border-emerald-100' : ''}`}>·</td>
    );
  }

  const tieneLineas = detalle && detalle.lineas.length > 0;

  return (
    <td
      style={{ backgroundColor: `rgba(5, 150, 105, ${0.06 + lvl * 0.35})` }}
      className={`px-2 py-2 text-center relative ${esCorte ? 'border-l border-r border-emerald-200' : ''}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span className={`font-mono tabular-nums font-medium ${tieneLineas ? 'cursor-help border-b border-dotted border-emerald-600 text-emerald-900' : 'text-emerald-900'}`}>
        {fmtMoney(valor)}
      </span>

      {open && tieneLineas && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 rounded-xl border border-slate-200 bg-white shadow-xl p-3 text-left pointer-events-none">
          <p className="text-[10px] font-bold uppercase text-slate-400 mb-2">
            {fmtFechaCorta(detalle!.lineas[0]?.fecha ?? '')}
          </p>
          <ul className="space-y-1.5">
            {detalle!.lineas.map((l, i) => (
              <li key={i} className="text-xs flex justify-between gap-2">
                <span className="text-slate-700">
                  {l.concepto}
                  {l.detalle && <span className="block text-[10px] text-slate-400">{l.detalle}</span>}
                </span>
                <span className="font-mono text-emerald-700 shrink-0">{fmtNomina(l.importe)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 pt-2 border-t flex justify-between text-xs font-bold">
            <span className="text-slate-500">Total día</span>
            <span className="text-emerald-800">{fmtNomina(valor)}</span>
          </div>
        </div>
      )}
    </td>
  );
}

export default function ResumenSemanaGrid({ dias, filas, totalesPorDia, maxCelda }: Props) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="px-4 py-2 bg-slate-50 border-b text-xs text-slate-500">
        Producción diaria · montos con línea punteada muestran concepto al pasar el mouse
      </div>
      <table className="min-w-full text-xs">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th className="sticky left-0 z-10 bg-slate-800 text-left px-4 py-3 font-semibold min-w-[180px]">Empleado</th>
            {dias.map(d => (
              <th
                key={d.iso}
                className={`px-2 py-3 text-center font-semibold min-w-[72px] ${
                  !d.esLaboral ? 'bg-slate-600/50 text-slate-300' : d.esCorte ? 'bg-emerald-900' : ''
                }`}
              >
                <span className="block text-[10px] uppercase opacity-80">{DIA_LABEL[d.diaSemana]}</span>
                <span className="block text-sm">{new Date(d.iso + 'T00:00:00').getDate()}</span>
                {d.esCorte && <span className="block text-[9px] text-emerald-200">corte</span>}
              </th>
            ))}
            <th className="px-3 py-3 text-right font-bold bg-emerald-900 min-w-[80px]">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filas.filter(f => f.total > 0).map(f => (
            <tr key={f.id} className="hover:bg-slate-50/80">
              <td className="sticky left-0 bg-white px-4 py-2 font-medium text-slate-800 whitespace-nowrap">
                {f.nombre.split(' ').slice(0, 2).join(' ')}
                <span className="block text-[10px] text-slate-400 font-normal truncate max-w-[160px]">
                  {f.nombre.split(' ').slice(2).join(' ')}
                </span>
              </td>
              {dias.map(d => {
                if (!d.esLaboral) {
                  return <td key={d.iso} className="px-2 py-2 text-center bg-slate-50 text-slate-300">—</td>;
                }
                return (
                  <CeldaDia
                    key={d.iso}
                    valor={f.porDia[d.iso] ?? 0}
                    detalle={f.detallePorDia?.[d.iso]}
                    maxCelda={maxCelda}
                    esCorte={d.esCorte}
                  />
                );
              })}
              <td className="px-3 py-2 text-right font-bold text-emerald-800 tabular-nums bg-emerald-50/50">
                {fmtMoney(f.total)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-700">
            <td className="sticky left-0 bg-slate-100 px-4 py-2.5">TOTAL DÍA</td>
            {dias.map(d => (
              <td key={d.iso} className={`px-2 py-2.5 text-center tabular-nums ${!d.esLaboral ? 'text-slate-300' : 'text-emerald-800'}`}>
                {d.esLaboral && (totalesPorDia[d.iso] ?? 0) > 0 ? fmtMoney(totalesPorDia[d.iso]) : '—'}
              </td>
            ))}
            <td className="px-3 py-2.5 text-right text-emerald-900 tabular-nums">
              {fmtMoney(filas.reduce((s, f) => s + f.total, 0))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
