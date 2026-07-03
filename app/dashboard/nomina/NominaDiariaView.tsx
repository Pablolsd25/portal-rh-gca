'use client';

import { fechasPeriodo, fmtMoney, heatLevel } from '@/lib/semana';
import type { CeldaDetalle } from '@/lib/nomina';
import { fmtNomina } from '@/lib/nomina';
import type { FilaNominaExcel } from './NominaExcelTable';

interface Props {
  filas: FilaNominaExcel[];
  inicio: string;
  fin: string;
  celdaMap: Record<string, Record<string, CeldaDetalle>>;
}

function CeldaHover({ valor, detalle, max }: { valor: number; detalle?: CeldaDetalle; max: number }) {
  if (valor <= 0) return <span className="text-slate-200">·</span>;
  const lvl = heatLevel(valor, max);
  const lineas = detalle?.lineas ?? [];

  return (
    <span
      className="relative inline-block group"
      title={lineas.map(l => `${l.concepto}: ${fmtNomina(l.importe)}`).join('\n')}
    >
      <span
        style={{ backgroundColor: `rgba(5,150,105,${0.08 + lvl * 0.4})` }}
        className={`inline-block px-1.5 py-0.5 rounded font-mono tabular-nums text-emerald-900 ${lineas.length ? 'cursor-help border-b border-dotted border-emerald-500' : ''}`}
      >
        {fmtMoney(valor)}
      </span>
      {lineas.length > 0 && (
        <span className="hidden group-hover:block absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1 w-48 rounded-lg border bg-white shadow-lg p-2 text-left pointer-events-none">
          {lineas.map((l, i) => (
            <div key={i} className="text-[10px] flex justify-between gap-1 py-0.5">
              <span className="text-slate-600">{l.concepto}</span>
              <span className="font-mono text-emerald-700">{fmtNomina(l.importe)}</span>
            </div>
          ))}
        </span>
      )}
    </span>
  );
}

export default function NominaDiariaView({ filas, inicio, fin, celdaMap }: Props) {
  const dias = fechasPeriodo(inicio, fin).filter(d => d.esLaboral);
  const DIA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  const rows = filas
    .map(f => {
      const porDia: Record<string, number> = {};
      let total = 0;
      const det = celdaMap[f.id] ?? {};
      for (const d of dias) {
        const v = det[d.iso]?.total ?? 0;
        porDia[d.iso] = v;
        total += v;
      }
      return { ...f, porDia, totalBonos: total };
    })
    .filter(r => r.totalBonos > 0)
    .sort((a, b) => b.totalBonos - a.totalBonos);

  const max = Math.max(...rows.flatMap(r => Object.values(r.porDia)), 1);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="px-4 py-2 bg-slate-50 border-b text-xs text-slate-500">
        Bonos y producción por día laboral · pasa el mouse para ver conceptos
      </div>
      <table className="min-w-full text-xs">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th className="sticky left-0 bg-slate-800 text-left px-4 py-3 min-w-[180px]">Empleado</th>
            {dias.map(d => (
              <th key={d.iso} className={`px-2 py-3 text-center ${d.esCorte ? 'bg-emerald-900' : ''}`}>
                <span className="block text-[10px] uppercase">{DIA[d.diaSemana]}</span>
                <span>{new Date(d.iso + 'T00:00:00').getDate()}</span>
              </th>
            ))}
            <th className="px-3 py-3 text-right bg-blue-900">Bonos</th>
            <th className="px-3 py-3 text-right bg-emerald-900">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(r => (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className="sticky left-0 bg-white px-4 py-2 font-medium text-slate-800">{r.nombre.split(' ').slice(0, 2).join(' ')}</td>
              {dias.map(d => (
                <td key={d.iso} className="px-2 py-2 text-center">
                  <CeldaHover valor={r.porDia[d.iso] ?? 0} detalle={celdaMap[r.id]?.[d.iso]} max={max} />
                </td>
              ))}
              <td className="px-3 py-2 text-right font-mono text-blue-700 font-semibold">{fmtNomina(r.totalBonos)}</td>
              <td className="px-3 py-2 text-right font-mono font-bold text-emerald-900">{fmtNomina(r.montos.sueldo + r.totalBonos - Math.abs(r.montos.pretLp + r.montos.prestCp + r.montos.infonavit + r.montos.dNoTrab))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
