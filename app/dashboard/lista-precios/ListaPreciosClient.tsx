'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  createMaterial,
  deleteMaterial,
  ivaDe,
  netoDe,
  updateListaMeta,
  updateMaterial,
  type ListaPreciosMeta,
  type Material,
} from '@/lib/listaPrecios';

type Props = {
  userId: string;
  meta: ListaPreciosMeta;
  materiales: Material[];
  canEdit?: boolean;
};

function fmt(n: number | null) {
  if (n == null) return '—';
  return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function parseNum(s: string): number | null {
  const t = s.trim().replace(/,/g, '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export default function ListaPreciosClient({
  meta: metaInit,
  materiales: materialesInit,
  canEdit = false,
}: Props) {
  const router = useRouter();
  const [meta, setMeta] = useState(metaInit);
  const [rows, setRows] = useState(materialesInit);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Material>>({});
  const [showNuevo, setShowNuevo] = useState(false);
  const [nuevo, setNuevo] = useState({
    descripcion: '',
    unidad: 'KG',
    precio_materialista: '',
    precio_edo_mex: '',
    precio_cdmx: '',
  });

  const filtrados = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      m => m.descripcion.toLowerCase().includes(s) || m.unidad.toLowerCase().includes(s),
    );
  }, [rows, q]);

  const flash = (msg: string) => {
    setOk(msg);
    setTimeout(() => setOk(null), 2500);
  };

  const guardarMeta = async () => {
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      await updateListaMeta(supabase, {
        empresa: meta.empresa,
        fecha_vigencia: meta.fecha_vigencia,
        notas: meta.notas,
      });
      flash('Cabecera guardada');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar cabecera');
    } finally {
      setSaving(false);
    }
  };

  const empezarEdit = (m: Material) => {
    setEditId(m.id);
    setDraft({ ...m });
    setError(null);
  };

  const guardarEdit = async () => {
    if (!editId || !draft.descripcion) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const patch = {
        descripcion: draft.descripcion!.trim(),
        unidad: (draft.unidad || 'KG').trim(),
        precio_materialista: draft.precio_materialista ?? null,
        precio_edo_mex: draft.precio_edo_mex ?? null,
        precio_cdmx: draft.precio_cdmx ?? null,
        destacado: Boolean(draft.destacado),
        disponible: draft.disponible !== false,
        notas: draft.notas ?? null,
      };
      await updateMaterial(supabase, editId, patch);
      setRows(prev => prev.map(r => (r.id === editId ? { ...r, ...patch } : r)));
      setEditId(null);
      flash('Material actualizado');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevo.descripcion.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const created = await createMaterial(supabase, {
        descripcion: nuevo.descripcion,
        unidad: nuevo.unidad,
        precio_materialista: parseNum(nuevo.precio_materialista),
        precio_edo_mex: parseNum(nuevo.precio_edo_mex),
        precio_cdmx: parseNum(nuevo.precio_cdmx),
        destacado: true,
      });
      setRows(prev => [...prev, created]);
      setShowNuevo(false);
      setNuevo({
        descripcion: '',
        unidad: 'KG',
        precio_materialista: '',
        precio_edo_mex: '',
        precio_cdmx: '',
      });
      flash('Material agregado (marcado en amarillo)');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear');
    } finally {
      setSaving(false);
    }
  };

  const borrar = async (id: string) => {
    if (!confirm('¿Eliminar este material de la lista?')) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      await deleteMaterial(supabase, id);
      setRows(prev => prev.filter(r => r.id !== id));
      flash('Eliminado');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">{error}</div>
      )}
      {ok && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-2 text-sm text-rose-800">{ok}</div>
      )}

      {canEdit ? (
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold text-slate-700">Cabecera del Excel</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            value={meta.empresa}
            onChange={e => setMeta({ ...meta, empresa: e.target.value })}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 md:col-span-2"
            placeholder="Empresa"
          />
          <input
            type="date"
            value={meta.fecha_vigencia?.slice(0, 10) ?? ''}
            onChange={e => setMeta({ ...meta, fecha_vigencia: e.target.value })}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
          />
          <input
            value={meta.notas ?? ''}
            onChange={e => setMeta({ ...meta, notas: e.target.value })}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 md:col-span-3"
            placeholder="Notas al pie"
          />
        </div>
        <button
          onClick={guardarMeta}
          disabled={saving}
          className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
        >
          Guardar cabecera
        </button>
      </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-600">
          <p className="font-semibold text-slate-800">{meta.empresa}</p>
          <p className="mt-1">Vigencia: {meta.fecha_vigencia?.slice(0, 10) || '—'}</p>
          {meta.notas && <p className="mt-1 text-xs text-slate-500">{meta.notas}</p>}
          <p className="mt-2 text-xs text-amber-700">Solo lectura. Solicita a RH/Admin para cambios.</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 justify-between">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar material…"
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 w-full sm:w-72"
        />
        {canEdit && (
        <button
          onClick={() => setShowNuevo(v => !v)}
          className="px-3 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-900"
        >
          {showNuevo ? 'Cerrar' : 'Agregar material'}
        </button>
        )}
      </div>

      {canEdit && showNuevo && (
        <form onSubmit={crear} className="bg-amber-50 border border-amber-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          <input
            required
            placeholder="Descripción"
            value={nuevo.descripcion}
            onChange={e => setNuevo({ ...nuevo, descripcion: e.target.value })}
            className="px-3 py-2 border rounded-lg text-sm text-slate-900 sm:col-span-2"
          />
          <input
            placeholder="Unidad"
            value={nuevo.unidad}
            onChange={e => setNuevo({ ...nuevo, unidad: e.target.value })}
            className="px-3 py-2 border rounded-lg text-sm text-slate-900"
          />
          <input
            placeholder="Precio Materialista"
            value={nuevo.precio_materialista}
            onChange={e => setNuevo({ ...nuevo, precio_materialista: e.target.value })}
            className="px-3 py-2 border rounded-lg text-sm text-slate-900"
          />
          <input
            placeholder="Precio Edo. Mex"
            value={nuevo.precio_edo_mex}
            onChange={e => setNuevo({ ...nuevo, precio_edo_mex: e.target.value })}
            className="px-3 py-2 border rounded-lg text-sm text-slate-900"
          />
          <input
            placeholder="Precio CDMX"
            value={nuevo.precio_cdmx}
            onChange={e => setNuevo({ ...nuevo, precio_cdmx: e.target.value })}
            className="px-3 py-2 border rounded-lg text-sm text-slate-900"
          />
          <button type="submit" disabled={saving} className="px-3 py-2 bg-rose-600 text-white text-sm rounded-lg sm:col-span-2 lg:col-span-1">
            Guardar
          </button>
        </form>
      )}

      <p className="text-xs text-slate-500">
        Filas en amarillo = cambios (como en el Excel). Precios sin IVA; el Excel calcula IVA 16% y neto.
      </p>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-xs min-w-[1100px]">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="px-2 py-2 text-left" rowSpan={2}>
                Descripción
              </th>
              <th className="px-2 py-2" rowSpan={2}>
                Unid.
              </th>
              <th className="px-2 py-2 text-center border-l border-slate-600" colSpan={3}>
                Materialista
              </th>
              <th className="px-2 py-2 text-center border-l border-slate-600" colSpan={3}>
                Edo. Mex
              </th>
              <th className="px-2 py-2 text-center border-l border-slate-600" colSpan={3}>
                CDMX
              </th>
              <th className="px-2 py-2" rowSpan={2} />
            </tr>
            <tr className="bg-slate-700 text-white">
              {['Precio', 'IVA', 'Neto', 'Precio', 'IVA', 'Neto', 'Precio', 'IVA', 'Neto'].map((h, i) => (
                <th key={i} className={`px-2 py-1 font-medium ${i % 3 === 0 ? 'border-l border-slate-600' : ''}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.map(m => {
              const editing = canEdit && editId === m.id;
              const src = editing ? { ...m, ...draft } : m;
              return (
                <tr
                  key={m.id}
                  className={`border-b border-slate-100 ${m.destacado ? 'bg-yellow-100' : 'hover:bg-slate-50'} ${
                    !m.disponible ? 'opacity-60' : ''
                  }`}
                >
                  <td className="px-2 py-1.5 font-medium text-slate-800 max-w-xs">
                    {editing ? (
                      <input
                        value={draft.descripcion ?? ''}
                        onChange={e => setDraft({ ...draft, descripcion: e.target.value })}
                        className="w-full px-1 py-0.5 border rounded text-slate-900"
                      />
                    ) : (
                      <>
                        {m.descripcion}
                        {m.notas && <span className="block text-[10px] text-amber-700">{m.notas}</span>}
                      </>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {editing ? (
                      <input
                        value={draft.unidad ?? ''}
                        onChange={e => setDraft({ ...draft, unidad: e.target.value })}
                        className="w-16 px-1 py-0.5 border rounded text-center text-slate-900"
                      />
                    ) : (
                      m.unidad
                    )}
                  </td>
                  {(
                    [
                      ['precio_materialista', src.precio_materialista],
                      ['precio_edo_mex', src.precio_edo_mex],
                      ['precio_cdmx', src.precio_cdmx],
                    ] as const
                  ).map(([field, precio]) => (
                    <FragmentPrecios
                      key={field}
                      editing={editing}
                      precio={precio}
                      onChange={v => setDraft({ ...draft, [field]: v })}
                    />
                  ))}
                  <td className="px-2 py-1.5 whitespace-nowrap text-right">
                    {editing ? (
                      <div className="flex flex-col gap-1 items-end">
                        <label className="flex items-center gap-1 text-[10px]">
                          <input
                            type="checkbox"
                            checked={Boolean(draft.destacado)}
                            onChange={e => setDraft({ ...draft, destacado: e.target.checked })}
                          />
                          Amarillo
                        </label>
                        <div className="flex gap-1">
                          <button
                            onClick={guardarEdit}
                            disabled={saving}
                            className="px-2 py-0.5 bg-rose-600 text-white rounded"
                          >
                            OK
                          </button>
                          <button onClick={() => setEditId(null)} className="px-2 py-0.5 border rounded">
                            X
                          </button>
                        </div>
                      </div>
                    ) : canEdit ? (
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => empezarEdit(m)} className="text-rose-700 hover:underline">
                          Editar
                        </button>
                        <button onClick={() => borrar(m.id)} className="text-red-600 hover:underline">
                          Borrar
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-slate-400">
                  Sin materiales. Ejecuta el seed o agrega uno.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FragmentPrecios({
  editing,
  precio,
  onChange,
}: {
  editing: boolean;
  precio: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <>
      <td className="px-1 py-1.5 text-right font-mono border-l border-slate-100">
        {editing ? (
          <input
            type="number"
            step="any"
            value={precio ?? ''}
            onChange={e => onChange(parseNum(e.target.value))}
            className="w-20 px-1 py-0.5 border rounded text-right text-slate-900"
          />
        ) : (
          fmt(precio)
        )}
      </td>
      <td className="px-1 py-1.5 text-right font-mono text-slate-500">{fmt(ivaDe(precio))}</td>
      <td className="px-1 py-1.5 text-right font-mono font-semibold text-slate-800">{fmt(netoDe(precio))}</td>
    </>
  );
}
