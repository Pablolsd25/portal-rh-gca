'use client';

import { useRouter } from 'next/navigation';
import CeldaDetalle from '@/components/CeldaDetalle';
import { borrarRegistroNomina } from '@/lib/borrarRegistro';
import { editarImporteNomina } from '@/lib/editarRegistro';
import { agregarDescuentoNomina } from '@/lib/agregarDescuento';
import {
  COLUMNAS_NOMINA,
  CONCEPTO_POR_COLUMNA,
  fmtNomina,
  totalIngresos,
  totalNeto as calcNeto,
  type ColumnaNominaKey,
  type DetalleNomina,
  type MontosNomina,
  type LineaDetalle,
} from '@/lib/nomina';

export interface FilaNominaExcel {
  id: string;
  nombre: string;
  montos: MontosNomina;
  detalle: DetalleNomina;
}

interface Props {
  filas: FilaNominaExcel[];
  periodoId: string;
  fechaCorte: string;
}

export default function NominaExcelTable({ filas, periodoId, fechaCorte }: Props) {
  const router = useRouter();
  const activas = filas.filter(f => calcNeto(f.montos) > 0 || f.montos.sueldo > 0);

  const totalesCol = COLUMNAS_NOMINA.reduce(
    (acc, c) => { acc[c.key] = 0; return acc; },
    {} as MontosNomina,
  );
  let sumIng = 0;
  let sumNeto = 0;
  for (const f of activas) {
    for (const c of COLUMNAS_NOMINA) totalesCol[c.key] += f.montos[c.key];
    sumIng += totalIngresos(f.montos);
    sumNeto += calcNeto(f.montos);
  }

  const handleBorrar = async (linea: LineaDetalle) => {
    const err = await borrarRegistroNomina(linea);
    if (err) { alert(err); return; }
    router.refresh();
  };

  const handleEditar = async (linea: LineaDetalle, importe: number) => {
    const err = await editarImporteNomina(linea, importe);
    if (err) { alert(err); return; }
    router.refresh();
  };

  const handleAgregarDescuento = async (empleadoId: string, col: ColumnaNominaKey, monto: number) => {
    const concepto = CONCEPTO_POR_COLUMNA[col];
    if (!concepto) return;
    const err = await agregarDescuentoNomina(periodoId, empleadoId, fechaCorte, concepto, monto);
    if (err) { alert(err); return; }
    router.refresh();
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white">
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
        <p className="text-xs text-slate-500">
          Formato Excel · <strong>clic</strong> en un monto con{' '}
          <span className="border-b border-dotted border-emerald-500 text-emerald-700">línea punteada</span>{' '}
          para ver desglose, editar o eliminar · clic en <strong className="text-red-500">+</strong> en columnas rojas para agregar descuento
        </p>
      </div>
      <table className="min-w-full text-[11px]">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th className="sticky left-0 z-20 bg-slate-800 text-left px-3 py-2.5 font-semibold min-w-[200px]">Nombre</th>
            {COLUMNAS_NOMINA.map(c => (
              <th
                key={c.key}
                className={`px-2 py-2.5 text-right font-semibold whitespace-nowrap min-w-[72px] ${
                  c.tipo === 'descuento' ? 'bg-red-900/40 text-red-100' : c.tipo === 'base' ? 'bg-slate-700' : ''
                }`}
              >
                {c.label}
              </th>
            ))}
            <th className="px-2 py-2.5 text-right font-bold bg-emerald-900 min-w-[88px]">Tot ing</th>
            <th className="px-3 py-2.5 text-right font-bold bg-emerald-800 min-w-[88px]">Total efvo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {activas.map((f, idx) => {
            const ing = totalIngresos(f.montos);
            const neto = calcNeto(f.montos);
            return (
              <tr key={f.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50 hover:bg-emerald-50/30'}>
                <td className="sticky left-0 z-10 bg-inherit px-3 py-2 font-medium text-slate-800 whitespace-nowrap border-r border-slate-100">
                  {f.nombre}
                </td>
                {COLUMNAS_NOMINA.map(c => {
                  const v = f.montos[c.key];
                  const esDesc = c.tipo === 'descuento';
                  const esSueldo = c.tipo === 'base';
                  const conceptoDesc = CONCEPTO_POR_COLUMNA[c.key];
                  return (
                    <td key={c.key} className={`px-2 py-2 text-right ${esDesc ? 'bg-red-50/30' : ''}`}>
                      {esSueldo ? (
                        <span className="font-mono tabular-nums text-slate-600">{fmtNomina(v)}</span>
                      ) : (
                        <CeldaDetalle
                          valor={v}
                          lineas={f.detalle[c.key]}
                          negativo={esDesc}
                          resaltar={c.tipo === 'ingreso' && v > 0}
                          onBorrar={handleBorrar}
                          onEditar={handleEditar}
                          labelAgregar={conceptoDesc}
                          onAgregar={conceptoDesc
                            ? (monto) => handleAgregarDescuento(f.id, c.key, monto)
                            : undefined}
                        />
                      )}
                    </td>
                  );
                })}
                <td className="px-2 py-2 text-right font-mono font-semibold text-slate-700 bg-emerald-50/40">
                  {fmtNomina(ing)}
                </td>
                <td className="px-3 py-2 text-right font-mono font-bold text-emerald-900 bg-emerald-50/60">
                  {fmtNomina(neto)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-800">
            <td className="sticky left-0 bg-slate-100 px-3 py-2.5 z-10">TOTALES</td>
            {COLUMNAS_NOMINA.map(c => (
              <td key={c.key} className={`px-2 py-2.5 text-right font-mono ${c.tipo === 'descuento' ? 'text-red-700' : ''}`}>
                {fmtNomina(Math.abs(totalesCol[c.key]))}
              </td>
            ))}
            <td className="px-2 py-2.5 text-right font-mono text-slate-800">{fmtNomina(sumIng)}</td>
            <td className="px-2 py-2.5 text-right font-mono text-emerald-900 bg-emerald-100">{fmtNomina(sumNeto)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
