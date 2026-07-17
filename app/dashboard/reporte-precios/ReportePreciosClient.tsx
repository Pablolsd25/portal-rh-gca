'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  material_description: string;
  brand: string;
  price: string;
  unit: string;
};

function newLine(): MaterialLine {
  return {
    key: crypto.randomUUID(),
    material_description: '',
    brand: '',
    price: '',
    unit: 'TON',
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
  const [q, setQ] = useState('');
  const [header, setHeader] = useState({
    entity_name: '',
    entity_type: 'competencia',
    zone: '',
    notes: '',
  });
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
        .limit(200);

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
    if (!s) return rows;
    return rows.filter(
      r =>
        r.entity_name.toLowerCase().includes(s) ||
        r.material_description.toLowerCase().includes(s) ||
        (r.zone || '').toLowerCase().includes(s) ||
        (r.brand || '').toLowerCase().includes(s) ||
        r.entity_type.toLowerCase().includes(s),
    );
  }, [rows, q]);

  const updateLine = (key: string, field: keyof MaterialLine, value: string) => {
    setLines(prev => prev.map(l => (l.key === key ? { ...l, [field]: value } : l)));
  };

  const pickMaterial = (key: string, description: string) => {
    const p = products.find(x => x.description === description);
    setLines(prev =>
      prev.map(l =>
        l.key === key
          ? { ...l, material_description: description, unit: p?.unit || l.unit }
          : l,
      ),
    );
  };

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const valid = lines
      .map(l => ({
        material_description: l.material_description.trim(),
        brand: l.brand.trim(),
        price: parseFloat(l.price),
        unit: l.unit.trim() || 'TON',
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
      setError('Agrega al menos un material con precio');
      return;
    }
    if (valid.some(l => !l.brand)) {
      setError('Indica la marca de cada material');
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const records = valid.map(l => ({
        seller_id: userId,
        entity_name: header.entity_name.trim(),
        entity_type: header.entity_type,
        zone: header.zone.trim(),
        notes: header.notes.trim() || null,
        material_description: l.material_description,
        price: l.price,
        brand: l.brand,
        unit: l.unit,
      }));
      const { error: err } = await supabase.from('price_reports').insert(records);
      if (err) throw err;
      setHeader({ entity_name: '', entity_type: 'competencia', zone: '', notes: '' });
      setLines([newLine()]);
      setShow(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  };

  const borrar = async (id: string) => {
    if (!confirm('¿Eliminar reporte?')) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.from('price_reports').delete().eq('id', id);
      if (err) throw err;
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center justify-between">
        <input
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full sm:w-72"
          placeholder="Buscar por entidad, material, zona, marca…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg"
        >
          {show ? 'Cancelar' : 'Nuevo reporte'}
        </button>
      </div>

      {show && (
        <form onSubmit={crear} className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
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

          <div className="border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Materiales y precios
              </p>
              <button
                type="button"
                onClick={() => setLines(prev => [...prev, newLine()])}
                className="text-xs text-rose-700 hover:underline"
              >
                + Agregar material
              </button>
            </div>
            <div className="space-y-2">
              {lines.map(line => (
                <div key={line.key} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-12 sm:col-span-5">
                    <input
                      list={`materials-${line.key}`}
                      placeholder="Material"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
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
                    className="col-span-4 sm:col-span-3 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    value={line.brand}
                    onChange={e => updateLine(line.key, 'brand', e.target.value)}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Precio"
                    className="col-span-4 sm:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    value={line.price}
                    onChange={e => updateLine(line.key, 'price', e.target.value)}
                  />
                  <input
                    placeholder="Unidad"
                    className="col-span-3 sm:col-span-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    value={line.unit}
                    onChange={e => updateLine(line.key, 'unit', e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setLines(prev =>
                        prev.length > 1 ? prev.filter(l => l.key !== line.key) : [newLine()],
                      )
                    }
                    className="col-span-1 text-xs text-red-600 hover:underline py-2"
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
            className="w-full px-4 py-2 bg-rose-600 text-white text-sm font-medium rounded-lg disabled:opacity-50"
          >
            {busy ? 'Guardando…' : `Guardar ${lines.length > 1 ? `${lines.length} reportes` : 'reporte'}`}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : (
        <ul className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
          {filtered.length === 0 ? (
            <li className="px-4 py-6 text-sm text-slate-500 text-center">
              {q ? 'Sin resultados con esa búsqueda' : 'Sin reportes'}
            </li>
          ) : (
            filtered.map(r => (
              <li key={r.id} className="px-4 py-3 flex justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {r.material_description} · {formatMoney(r.price)}
                    {r.unit ? ` / ${r.unit}` : ''}
                  </p>
                  <p className="text-xs text-slate-500">
                    {r.entity_name} ({r.entity_type})
                    {r.zone ? ` · ${r.zone}` : ''}
                    {r.brand ? ` · ${r.brand}` : ''}
                    {isAdmin && r.seller?.full_name ? ` · ${r.seller.full_name}` : ''}
                  </p>
                  <p className="text-xs text-slate-400">
                    {new Date(r.reported_at).toLocaleString('es-MX')}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void borrar(r.id)}
                  className="text-xs text-red-600 hover:underline self-start"
                >
                  Eliminar
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
