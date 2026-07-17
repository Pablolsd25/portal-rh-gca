'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BuildingStorefrontIcon,
  CurrencyDollarIcon,
  MapPinIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { createClient } from '@/lib/supabase/client';
import { formatMoney } from '@/lib/ventas/quotes';
import { products } from '@/lib/ventas/products';

type Report = {
  id: string;
  entity_name: string;
  entity_type: string;
  material_description: string;
  price: number;
  zone: string | null;
  brand: string | null;
  unit: string | null;
  notes: string | null;
  reported_at: string;
  seller?: { full_name: string } | null;
};

type MaterialLine = {
  key: string;
  id?: string;
  material_description: string;
  brand: string;
  price: string;
};

type ReportGroup = {
  key: string;
  entity_name: string;
  entity_type: string;
  zone: string;
  notes: string | null;
  sellerName: string | null;
  latestAt: string;
  materials: Report[];
};

const PAGE_SIZE = 8;
const UNIT = 'TON';

function newLine(): MaterialLine {
  return {
    key: crypto.randomUUID(),
    material_description: '',
    brand: '',
    price: '',
  };
}

function pricePerTon(price: number, unit: string | null): number {
  const u = (unit || '').trim().toUpperCase();
  if (u === 'KG' || u === 'KILO' || u === 'KILOS' || u === 'K') {
    return price * 1000;
  }
  return price;
}

function isLegacyKg(unit: string | null): boolean {
  const u = (unit || '').trim().toUpperCase();
  return u === 'KG' || u === 'KILO' || u === 'KILOS' || u === 'K';
}

function groupKey(r: Report): string {
  return [
    r.entity_name.trim().toLowerCase(),
    r.entity_type.trim().toLowerCase(),
    (r.zone || '').trim().toLowerCase(),
  ].join('|');
}

function dayKeyMexico(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
}

function emptyHeader() {
  return {
    entity_name: '',
    entity_type: 'competencia',
    zone: '',
    notes: '',
  };
}

export default function ReportePreciosClient({
  userId,
  role,
}: {
  userId: string;
  role: string;
}) {
  const isAdmin = role.trim().toLowerCase() === 'admin';
  const [rows, setRows] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [editingGroupKey, setEditingGroupKey] = useState<string | null>(null);
  const [originalIds, setOriginalIds] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [header, setHeader] = useState(emptyHeader);
  const [lines, setLines] = useState<MaterialLine[]>([newLine()]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      let query = supabase
        .from('price_reports')
        .select(
          'id, entity_name, entity_type, material_description, price, zone, brand, unit, notes, reported_at, seller:seller_id(full_name)',
        )
        .order('reported_at', { ascending: false })
        .limit(500);

      if (!isAdmin) {
        query = query.eq('seller_id', userId);
      }

      const { data, error: err } = await query;
      if (err) throw err;
      setRows((data as unknown as Report[]) || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar reportes');
    } finally {
      setLoading(false);
    }
  }, [userId, isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter(r => {
      if (dateFrom || dateTo) {
        const day = dayKeyMexico(r.reported_at);
        if (dateFrom && day < dateFrom) return false;
        if (dateTo && day > dateTo) return false;
      }
      if (!s) return true;
      return (
        r.entity_name.toLowerCase().includes(s) ||
        r.material_description.toLowerCase().includes(s) ||
        (r.zone || '').toLowerCase().includes(s) ||
        (r.brand || '').toLowerCase().includes(s) ||
        r.entity_type.toLowerCase().includes(s)
      );
    });
  }, [rows, q, dateFrom, dateTo]);

  const groups = useMemo(() => {
    const map = new Map<string, ReportGroup>();
    for (const r of filtered) {
      const key = groupKey(r);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          entity_name: r.entity_name,
          entity_type: r.entity_type,
          zone: r.zone || '',
          notes: r.notes,
          sellerName: r.seller?.full_name || null,
          latestAt: r.reported_at,
          materials: [r],
        });
      } else {
        existing.materials.push(r);
        if (r.reported_at > existing.latestAt) {
          existing.latestAt = r.reported_at;
          existing.notes = r.notes || existing.notes;
          existing.sellerName = r.seller?.full_name || existing.sellerName;
        }
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime(),
    );
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageGroups = groups.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const resetForm = () => {
    setEditingGroupKey(null);
    setOriginalIds([]);
    setHeader(emptyHeader());
    setLines([newLine()]);
    setShow(false);
  };

  const openNew = () => {
    setEditingGroupKey(null);
    setOriginalIds([]);
    setHeader(emptyHeader());
    setLines([newLine()]);
    setShow(true);
    setError(null);
  };

  const openEdit = (group: ReportGroup) => {
    setEditingGroupKey(group.key);
    setOriginalIds(group.materials.map(m => m.id));
    setHeader({
      entity_name: group.entity_name,
      entity_type: group.entity_type,
      zone: group.zone,
      notes: group.notes || '',
    });
    setLines(
      group.materials.map(m => ({
        key: crypto.randomUUID(),
        id: m.id,
        material_description: m.material_description,
        brand: m.brand || '',
        price: String(pricePerTon(m.price, m.unit)),
      })),
    );
    setShow(true);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const updateLine = (key: string, field: keyof MaterialLine, value: string) => {
    setLines(prev => prev.map(l => (l.key === key ? { ...l, [field]: value } : l)));
  };

  const pickMaterial = (key: string, description: string) => {
    setLines(prev =>
      prev.map(l => (l.key === key ? { ...l, material_description: description } : l)),
    );
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const valid = lines
      .map(l => ({
        id: l.id,
        material_description: l.material_description.trim(),
        brand: l.brand.trim(),
        price: parseFloat(l.price),
      }))
      .filter(l => l.material_description && l.price > 0);

    if (!header.entity_name.trim()) {
      setError('Indica el nombre del cliente / competencia');
      return;
    }
    if (!header.zone.trim()) {
      setError('La zona es obligatoria');
      return;
    }
    if (!valid.length) {
      setError('Agrega al menos un material con precio por tonelada');
      return;
    }
    if (valid.some(l => !l.brand)) {
      setError('Indica la marca de cada material');
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const base = {
        entity_name: header.entity_name.trim(),
        entity_type: header.entity_type,
        zone: header.zone.trim(),
        notes: header.notes.trim() || null,
        unit: UNIT,
      };

      if (editingGroupKey) {
        const keptIds = valid.map(l => l.id).filter(Boolean) as string[];
        const toDelete = originalIds.filter(id => !keptIds.includes(id));
        if (toDelete.length) {
          const { error: delErr } = await supabase.from('price_reports').delete().in('id', toDelete);
          if (delErr) throw delErr;
        }

        for (const l of valid) {
          const payload = {
            ...base,
            material_description: l.material_description,
            price: l.price,
            brand: l.brand,
          };
          if (l.id) {
            const { error: updErr } = await supabase
              .from('price_reports')
              .update(payload)
              .eq('id', l.id);
            if (updErr) throw updErr;
          } else {
            const { error: insErr } = await supabase
              .from('price_reports')
              .insert({ ...payload, seller_id: userId });
            if (insErr) throw insErr;
          }
        }
      } else {
        const records = valid.map(l => ({
          ...base,
          seller_id: userId,
          material_description: l.material_description,
          price: l.price,
          brand: l.brand,
        }));
        const { error: err } = await supabase.from('price_reports').insert(records);
        if (err) throw err;
      }

      resetForm();
      setPage(1);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  };

  const borrarMaterial = async (id: string) => {
    if (!confirm('¿Eliminar este material del reporte?')) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.from('price_reports').delete().eq('id', id);
      if (err) throw err;
      if (editingGroupKey) {
        setLines(prev => prev.filter(l => l.id !== id));
        setOriginalIds(prev => prev.filter(x => x !== id));
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar');
    } finally {
      setBusy(false);
    }
  };

  const borrarGrupo = async (group: ReportGroup) => {
    if (
      !confirm(`¿Eliminar los ${group.materials.length} materiales de «${group.entity_name}»?`)
    ) {
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const ids = group.materials.map(m => m.id);
      const { error: err } = await supabase.from('price_reports').delete().in('id', ids);
      if (err) throw err;
      if (editingGroupKey === group.key) resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar');
    } finally {
      setBusy(false);
    }
  };

  const hasDateFilter = Boolean(dateFrom || dateTo);

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-lg px-4 py-2.5">
        Todos los precios se capturan y muestran en <strong>pesos por tonelada (TON)</strong>. Si un
        reporte antiguo estaba en KG, se convierte automáticamente al visualizar (×1,000).
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <input
            type="search"
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full sm:w-80 focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
            placeholder="Buscar por entidad, material, zona, marca…"
            value={q}
            onChange={e => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-slate-500">
              {groups.length} comercios · {filtered.length} materiales
            </span>
            <button
              type="button"
              onClick={() => (show && !editingGroupKey ? resetForm() : openNew())}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-800 hover:bg-rose-900 text-white text-sm font-medium rounded-lg"
            >
              {show && !editingGroupKey ? (
                'Cancelar'
              ) : (
                <>
                  <PlusIcon className="w-4 h-4" />
                  Nuevo reporte
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 pt-1 border-t border-slate-100">
          <label className="text-xs text-slate-600">
            Desde
            <input
              type="date"
              value={dateFrom}
              onChange={e => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="mt-1 block border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white"
            />
          </label>
          <label className="text-xs text-slate-600">
            Hasta
            <input
              type="date"
              value={dateTo}
              onChange={e => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="mt-1 block border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white"
            />
          </label>
          {hasDateFilter && (
            <button
              type="button"
              onClick={() => {
                setDateFrom('');
                setDateTo('');
                setPage(1);
              }}
              className="text-xs text-rose-800 hover:underline px-2 py-1.5"
            >
              Limpiar fechas
            </button>
          )}
        </div>
      </div>

      {show && (
        <form
          onSubmit={guardar}
          className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 shadow-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-800">
              {editingGroupKey ? 'Editar reporte' : 'Nuevo reporte'}
            </p>
            {editingGroupKey && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-slate-500 hover:underline"
              >
                Cancelar edición
              </button>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Cliente / comercio (una sola vez)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                required
                placeholder="Nombre cliente / competencia"
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                value={header.entity_name}
                onChange={e => setHeader(h => ({ ...h, entity_name: e.target.value }))}
              />
              <select
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                value={header.entity_type}
                onChange={e => setHeader(h => ({ ...h, entity_type: e.target.value }))}
              >
                <option value="competencia">Competencia</option>
                <option value="cliente">Cliente</option>
              </select>
              <input
                required
                placeholder="Zona / ubicación (obligatorio)"
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                value={header.zone}
                onChange={e => setHeader(h => ({ ...h, zone: e.target.value }))}
              />
              <input
                placeholder="Notas (opcional)"
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                value={header.notes}
                onChange={e => setHeader(h => ({ ...h, notes: e.target.value }))}
              />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Materiales y precios
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Agrega o edita materiales del mismo comercio. Precio siempre por tonelada.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLines(prev => [...prev, newLine()])}
                className="inline-flex items-center gap-1 text-xs font-medium text-rose-800 hover:underline"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                Agregar material
              </button>
            </div>

            <div className="hidden sm:grid grid-cols-12 gap-2 px-1 mb-1 text-[10px] font-semibold uppercase text-slate-400">
              <span className="col-span-5">Material</span>
              <span className="col-span-3">Marca</span>
              <span className="col-span-3">Precio / TON</span>
              <span className="col-span-1" />
            </div>

            <div className="space-y-2">
              {lines.map(line => (
                <div
                  key={line.key}
                  className="grid grid-cols-12 gap-2 items-center bg-slate-50 border border-slate-200 rounded-lg p-2"
                >
                  <div className="col-span-12 sm:col-span-5">
                    <input
                      list={`materials-${line.key}`}
                      placeholder="Material"
                      className="w-full border border-slate-300 rounded-md px-2.5 py-1.5 text-sm bg-white"
                      value={line.material_description}
                      onChange={e => pickMaterial(line.key, e.target.value)}
                    />
                    <datalist id={`materials-${line.key}`}>
                      {products.map(p => (
                        <option key={p.description} value={p.description} />
                      ))}
                    </datalist>
                  </div>
                  <input
                    placeholder="Marca"
                    className="col-span-5 sm:col-span-3 border border-slate-300 rounded-md px-2.5 py-1.5 text-sm bg-white"
                    value={line.brand}
                    onChange={e => updateLine(line.key, 'brand', e.target.value)}
                  />
                  <div className="col-span-5 sm:col-span-3 relative">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className="w-full border border-slate-300 rounded-md pl-2.5 pr-12 py-1.5 text-sm bg-white"
                      value={line.price}
                      onChange={e => updateLine(line.key, 'price', e.target.value)}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded">
                      TON
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setLines(prev =>
                        prev.length > 1 ? prev.filter(l => l.key !== line.key) : [newLine()],
                      )
                    }
                    className="col-span-2 sm:col-span-1 text-xs text-red-600 hover:underline py-1.5 justify-self-end"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full px-4 py-2.5 bg-rose-800 hover:bg-rose-900 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
          >
            {busy
              ? 'Guardando…'
              : editingGroupKey
                ? `Guardar cambios (${lines.length} material${lines.length === 1 ? '' : 'es'})`
                : `Guardar reporte (${lines.length} material${lines.length === 1 ? '' : 'es'})`}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : pageGroups.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-10 text-center text-sm text-slate-500">
          {q || hasDateFilter ? 'Sin resultados con esos filtros' : 'Sin reportes'}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {pageGroups.map(group => (
              <article
                key={group.key}
                className={`bg-white border rounded-xl shadow-sm overflow-hidden transition-colors ${
                  editingGroupKey === group.key
                    ? 'border-rose-400 ring-1 ring-rose-200'
                    : 'border-slate-200 hover:border-rose-200'
                }`}
              >
                <header className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <BuildingStorefrontIcon className="w-4 h-4 text-rose-800 shrink-0" />
                      <h3 className="text-sm font-semibold text-slate-800 truncate">
                        {group.entity_name}
                      </h3>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize ${
                          group.entity_type === 'cliente'
                            ? 'bg-sky-100 text-sky-700'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {group.entity_type}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-slate-500">
                      {group.zone && (
                        <span className="inline-flex items-center gap-1">
                          <MapPinIcon className="w-3 h-3" />
                          {group.zone}
                        </span>
                      )}
                      <span>
                        Último:{' '}
                        {new Date(group.latestAt).toLocaleString('es-MX', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </span>
                      {isAdmin && group.sellerName && <span>Vendedor: {group.sellerName}</span>}
                      {group.notes && <span className="italic truncate max-w-xs">{group.notes}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => openEdit(group)}
                      className="inline-flex items-center gap-1 text-xs text-amber-700 hover:bg-amber-50 px-2 py-1 rounded-md disabled:opacity-40"
                      title="Editar reporte"
                    >
                      <PencilSquareIcon className="w-3.5 h-3.5" />
                      Editar
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void borrarGrupo(group)}
                      className="inline-flex items-center gap-1 text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded-md disabled:opacity-40"
                      title="Eliminar todo el grupo"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                      Eliminar
                    </button>
                  </div>
                </header>

                <ul className="divide-y divide-slate-100">
                  {group.materials.map(m => {
                    const tonPrice = pricePerTon(m.price, m.unit);
                    const legacy = isLegacyKg(m.unit);
                    return (
                      <li
                        key={m.id}
                        className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800">
                            {m.material_description}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {m.brand || 'Sin marca'} ·{' '}
                            {new Date(m.reported_at).toLocaleDateString('es-MX')}
                            {legacy && (
                              <span className="ml-2 text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                                capturado en KG → mostrado en TON
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="inline-flex items-center gap-1 text-sm font-bold text-rose-800">
                            <CurrencyDollarIcon className="w-4 h-4" />
                            {formatMoney(tonPrice)}
                            <span className="text-[10px] font-semibold text-slate-500">/ TON</span>
                          </span>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void borrarMaterial(m.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-md disabled:opacity-40"
                            title="Eliminar material"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </article>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="text-xs text-slate-500">
                Página {currentPage} de {totalPages} · {groups.length} comercios
              </span>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
