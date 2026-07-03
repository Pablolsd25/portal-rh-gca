'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LineaDetalle } from '@/lib/nomina';
import { fmtNomina, fmtFechaCorta } from '@/lib/nomina';

interface Props {
  valor: number;
  lineas?: LineaDetalle[];
  vacio?: string;
  className?: string;
  negativo?: boolean;
  resaltar?: boolean;
  onBorrar?: (linea: LineaDetalle) => Promise<void>;
  onEditar?: (linea: LineaDetalle, importe: number) => Promise<void>;
  labelAgregar?: string;
  onAgregar?: (monto: number) => Promise<void>;
}

export default function CeldaDetalle({
  valor, lineas = [], vacio = '—', className = '', negativo, resaltar, onBorrar, onEditar,
  labelAgregar, onAgregar,
}: Props) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, arriba: false });
  const [busy, setBusy] = useState<string | null>(null);
  const [nuevoMonto, setNuevoMonto] = useState('');
  const tieneDetalle = lineas.length > 0;
  const mostrar = valor !== 0;
  const puedeAgregar = !!onAgregar && !!labelAgregar;

  const calcularPos = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const panelH = puedeAgregar && !mostrar ? 160 : 220;
    const arriba = r.bottom + panelH > window.innerHeight - 16;
    setPos({
      top: arriba ? r.top - 8 : r.bottom + 8,
      left: Math.min(Math.max(8, r.left + r.width / 2 - 128), window.innerWidth - 272),
      arriba,
    });
  }, [puedeAgregar, mostrar]);

  useEffect(() => {
    if (!open) return;
    calcularPos();
    const cerrar = () => setOpen(false);
    window.addEventListener('scroll', cerrar, true);
    window.addEventListener('resize', calcularPos);
    return () => {
      window.removeEventListener('scroll', cerrar, true);
      window.removeEventListener('resize', calcularPos);
    };
  }, [open, calcularPos]);

  const handleBorrar = async (linea: LineaDetalle, key: string) => {
    if (!onBorrar || !linea.registroId) return;
    if (!confirm(`¿Eliminar ${linea.concepto} por ${fmtNomina(linea.importe)}?`)) return;
    setBusy(key);
    await onBorrar(linea);
    setBusy(null);
    setOpen(false);
  };

  const handleEditar = async (linea: LineaDetalle, key: string) => {
    if (!onEditar || !linea.registroId) return;
    const raw = prompt(`Nuevo importe para ${linea.concepto}:`, String(Math.abs(linea.importe)));
    if (raw === null) return;
    const n = parseFloat(raw.replace(/,/g, ''));
    if (Number.isNaN(n)) { alert('Importe inválido'); return; }
    const importe = negativo ? -Math.abs(n) : n;
    setBusy(key);
    await onEditar(linea, importe);
    setBusy(null);
    setOpen(false);
  };

  const handleAgregar = async () => {
    if (!onAgregar) return;
    const n = parseFloat(nuevoMonto.replace(/,/g, ''));
    if (Number.isNaN(n) || n <= 0) { alert('Ingresa un monto mayor a 0'); return; }
    setBusy('add');
    await onAgregar(n);
    setBusy(null);
    setNuevoMonto('');
    setOpen(false);
  };

  if (!mostrar && !puedeAgregar) {
    return <span className={`text-slate-300 ${className}`}>{vacio}</span>;
  }

  const texto = fmtNomina(Math.abs(valor), vacio);
  const display = mostrar
    ? (negativo && valor < 0 ? `-${texto.replace('$', '')}` : texto)
    : '+';

  const panel = open && typeof document !== 'undefined' ? createPortal(
    <>
      <div className="fixed inset-0 z-[100]" onClick={() => setOpen(false)} aria-hidden />
      <div
        role="dialog"
        className="fixed z-[101] w-64 rounded-xl border border-slate-200 bg-white shadow-2xl p-3 text-left"
        style={{ top: pos.top, left: pos.left, transform: pos.arriba ? 'translateY(-100%)' : undefined }}
        onClick={e => e.stopPropagation()}
      >
        {puedeAgregar && (
          <div className={tieneDetalle ? 'mb-3 pb-3 border-b border-slate-100' : ''}>
            <p className="text-[10px] font-bold uppercase text-slate-400 mb-2">Agregar {labelAgregar}</p>
            <div className="flex gap-1">
              <input
                type="number"
                min="0"
                step="0.01"
                value={nuevoMonto}
                onChange={e => setNuevoMonto(e.target.value)}
                placeholder="Monto"
                className="flex-1 px-2 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900"
              />
              <button
                type="button"
                disabled={busy === 'add'}
                onClick={handleAgregar}
                className="px-2 py-1.5 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-40"
              >
                {busy === 'add' ? '…' : 'OK'}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Se guardará como descuento</p>
          </div>
        )}

        {tieneDetalle && (
          <>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
              Desglose · ✎ editar · ✕ eliminar
            </p>
            <ul className="space-y-2 max-h-56 overflow-y-auto">
              {lineas.map((l, i) => {
                const key = (l.registroId ?? '') + (l.campoEmbarque ?? '') + i;
                const editable = l.registroId && (onBorrar || onEditar);
                return (
                  <li key={key} className="text-xs border-b border-slate-50 pb-2 last:border-0">
                    <div className="flex justify-between gap-2 items-start">
                      <span className="text-slate-800 font-medium flex-1">{l.concepto}</span>
                      <span className={`font-mono tabular-nums shrink-0 ${l.importe < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                        {fmtNomina(l.importe)}
                      </span>
                    </div>
                    {l.fecha && <p className="text-[10px] text-slate-400 mt-0.5">{fmtFechaCorta(l.fecha)}</p>}
                    {editable && (
                      <div className="flex gap-1 mt-1.5">
                        {onEditar && (
                          <button type="button" disabled={busy === key} onClick={() => handleEditar(l, key)}
                            className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40">
                            {busy === key ? '…' : '✎ Editar'}
                          </button>
                        )}
                        {onBorrar && (
                          <button type="button" disabled={busy === key} onClick={() => handleBorrar(l, key)}
                            className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40">
                            {busy === key ? '…' : '✕ Eliminar'}
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {mostrar && (
              <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between text-xs font-bold">
                <span className="text-slate-500">Total</span>
                <span className={valor < 0 ? 'text-red-700' : 'text-emerald-800'}>{fmtNomina(valor)}</span>
              </div>
            )}
          </>
        )}
      </div>
    </>,
    document.body,
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => { calcularPos(); setOpen(v => !v); }}
        className={`font-mono tabular-nums cursor-pointer bg-transparent p-0 ${
          mostrar
            ? `border-b border-dotted ${negativo ? 'text-red-600 border-red-300' : 'text-emerald-800 border-emerald-400 font-semibold'}`
            : 'text-red-400 hover:text-red-600 text-sm font-bold'
        } ${className}`}
        title={puedeAgregar && !mostrar ? `Agregar ${labelAgregar}` : undefined}
      >
        {display}
      </button>
      {panel}
    </>
  );
}
