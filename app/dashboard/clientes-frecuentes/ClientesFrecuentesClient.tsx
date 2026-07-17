'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type FC = {
  id: string;
  full_name: string;
  business_name: string | null;
  phone_number: string | null;
  email: string | null;
  address: string | null;
  location_url: string | null;
};

const empty = {
  full_name: '',
  business_name: '',
  phone_number: '',
  email: '',
  address: '',
  location_url: '',
};

export default function ClientesFrecuentesClient({ userId }: { userId: string }) {
  const [rows, setRows] = useState<FC[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [show, setShow] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from('frequent_clients')
        .select('id, full_name, business_name, phone_number, email, address, location_url')
        .eq('seller_id', userId)
        .order('full_name');
      if (err) throw err;
      setRows((data as FC[]) || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = rows.filter(r => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (
      r.full_name.toLowerCase().includes(s) ||
      (r.business_name || '').toLowerCase().includes(s) ||
      (r.phone_number || '').includes(s)
    );
  });

  const openNew = () => {
    setEditId(null);
    setForm(empty);
    setShow(true);
  };

  const openEdit = (r: FC) => {
    setEditId(r.id);
    setForm({
      full_name: r.full_name,
      business_name: r.business_name || '',
      phone_number: r.phone_number || '',
      email: r.email || '',
      address: r.address || '',
      location_url: r.location_url || '',
    });
    setShow(true);
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const payload = {
        full_name: form.full_name.trim(),
        business_name: form.business_name.trim() || null,
        phone_number: form.phone_number.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        location_url: form.location_url.trim() || null,
        seller_id: userId,
      };
      if (editId) {
        const { error: err } = await supabase.from('frequent_clients').update(payload).eq('id', editId);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('frequent_clients').insert(payload);
        if (err) throw err;
      }
      setShow(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  };

  const borrar = async (id: string) => {
    if (!confirm('¿Eliminar cliente frecuente?')) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.from('frequent_clients').delete().eq('id', id);
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

      <div className="flex flex-wrap gap-3 justify-between">
        <input
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full sm:w-64"
          placeholder="Buscar…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <button
          type="button"
          onClick={openNew}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg"
        >
          Nuevo
        </button>
      </div>

      {show && (
        <form
          onSubmit={guardar}
          className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          {(
            [
              ['full_name', 'Nombre *'],
              ['business_name', 'Negocio'],
              ['phone_number', 'Teléfono'],
              ['email', 'Email'],
              ['address', 'Dirección'],
              ['location_url', 'URL mapa'],
            ] as const
          ).map(([key, label]) => (
            <input
              key={key}
              required={key === 'full_name'}
              placeholder={label}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={form[key]}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            />
          ))}
          <div className="sm:col-span-2 flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 bg-rose-600 text-white text-sm font-medium rounded-lg disabled:opacity-50"
            >
              {editId ? 'Actualizar' : 'Crear'}
            </button>
            <button
              type="button"
              onClick={() => setShow(false)}
              className="px-4 py-2 text-sm text-slate-600 hover:underline"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : (
        <ul className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
          {filtered.length === 0 ? (
            <li className="px-4 py-6 text-sm text-slate-500 text-center">Sin clientes</li>
          ) : (
            filtered.map(r => (
              <li key={r.id} className="px-4 py-3 flex justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{r.full_name}</p>
                  <p className="text-xs text-slate-500">
                    {[r.business_name, r.phone_number, r.email].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="flex gap-2 text-xs shrink-0">
                  <button type="button" className="text-rose-700 hover:underline" onClick={() => openEdit(r)}>
                    Editar
                  </button>
                  <button
                    type="button"
                    className="text-red-600 hover:underline"
                    disabled={busy}
                    onClick={() => void borrar(r.id)}
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
