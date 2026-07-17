'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BuildingStorefrontIcon,
  EnvelopeIcon,
  MapPinIcon,
  PencilSquareIcon,
  PhoneIcon,
  PlusIcon,
  TrashIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
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

const PAGE_SIZE = 12;

const AVATAR_COLORS = [
  'bg-rose-100 text-rose-700',
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-amber-100 text-amber-700',
  'bg-teal-100 text-teal-700',
  'bg-indigo-100 text-indigo-700',
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

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

  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      r =>
        r.full_name.toLowerCase().includes(s) ||
        (r.business_name || '').toLowerCase().includes(s) ||
        (r.phone_number || '').includes(s),
    );
  }, [rows, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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

      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-[200px]">
          <input
            type="search"
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full sm:w-72 focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
            placeholder="Buscar por nombre, negocio o teléfono…"
            value={q}
            onChange={e => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-500">
            <UserGroupIcon className="w-4 h-4" />
            {filtered.length} cliente{filtered.length === 1 ? '' : 's'}
          </span>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-800 hover:bg-rose-900 text-white text-sm font-medium rounded-lg"
        >
          <PlusIcon className="w-4 h-4" />
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-slate-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-slate-200 rounded w-3/4" />
                  <div className="h-2.5 bg-slate-100 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-12 text-center">
          <UserGroupIcon className="w-12 h-12 mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">
            {q ? 'Sin resultados para esa búsqueda' : 'Aún no tienes clientes frecuentes'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pageRows.map(r => (
              <div
                key={r.id}
                className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-rose-200 hover:shadow-md transition-all flex flex-col"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${avatarColor(r.full_name)}`}
                  >
                    {initials(r.full_name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 leading-snug">
                      {r.full_name}
                    </p>
                    {r.business_name && (
                      <p className="inline-flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                        <BuildingStorefrontIcon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{r.business_name}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-slate-600 flex-1">
                  {r.phone_number && (
                    <a
                      href={`tel:${r.phone_number}`}
                      className="flex items-center gap-1.5 hover:text-rose-800"
                    >
                      <PhoneIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {r.phone_number}
                    </a>
                  )}
                  {r.email && (
                    <a
                      href={`mailto:${r.email}`}
                      className="flex items-center gap-1.5 hover:text-rose-800"
                    >
                      <EnvelopeIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{r.email}</span>
                    </a>
                  )}
                  {r.address && (
                    <p className="flex items-start gap-1.5">
                      <MapPinIcon className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{r.address}</span>
                    </p>
                  )}
                  {!r.phone_number && !r.email && !r.address && (
                    <p className="text-slate-400 italic">Sin datos de contacto</p>
                  )}
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                  {r.location_url ? (
                    <a
                      href={r.location_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-700 bg-sky-50 px-2 py-1 rounded-full hover:bg-sky-100"
                    >
                      <MapPinIcon className="w-3 h-3" />
                      Ver mapa
                    </a>
                  ) : (
                    <span />
                  )}
                  <div className="flex gap-1">
                    <button
                      type="button"
                      title="Editar"
                      onClick={() => openEdit(r)}
                      className="p-1.5 rounded-md text-amber-600 hover:bg-amber-50"
                    >
                      <PencilSquareIcon className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      title="Eliminar"
                      disabled={busy}
                      onClick={() => void borrar(r.id)}
                      className="p-1.5 rounded-md text-red-500 hover:bg-red-50 disabled:opacity-40"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="text-xs text-slate-500">
                Mostrando {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, filtered.length)} de {filtered.length} · Página{' '}
                {currentPage} de {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40"
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
