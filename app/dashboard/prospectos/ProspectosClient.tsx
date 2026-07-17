'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type Prospect = {
  id: string;
  full_name: string;
  phone_number: string | null;
  email: string | null;
  status: string;
  ubicacion: string | null;
  created_at: string;
};

const STATUSES = ['nuevo', 'contactado', 'interesado', 'cotizado', 'convertido', 'descartado'];
const PAGE_SIZE = 10;

const STATUS_STYLES: Record<string, string> = {
  nuevo: 'bg-sky-100 text-sky-700',
  contactado: 'bg-indigo-100 text-indigo-700',
  interesado: 'bg-amber-100 text-amber-700',
  cotizado: 'bg-purple-100 text-purple-700',
  convertido: 'bg-emerald-100 text-emerald-700',
  descartado: 'bg-slate-100 text-slate-500',
};

function isUrl(s: string | null): s is string {
  if (!s) return false;
  try {
    new URL(s);
    return true;
  } catch {
    return false;
  }
}

export default function ProspectosClient({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Prospect[]>([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    phone_number: '',
    email: '',
    ubicacion: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from('prospects')
        .select('id, full_name, phone_number, email, status, ubicacion, created_at')
        .order('created_at', { ascending: false });
      if (err) throw err;
      setRows((data as Prospect[]) || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar prospectos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter(r => {
      if (statusFilter !== 'all' && (r.status || 'nuevo').toLowerCase() !== statusFilter) {
        return false;
      }
      if (!s) return true;
      return (
        r.full_name.toLowerCase().includes(s) ||
        (r.phone_number || '').includes(s) ||
        (r.email || '').toLowerCase().includes(s) ||
        (r.ubicacion || '').toLowerCase().includes(s)
      );
    });
  }, [rows, q, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.from('prospects').insert({
        full_name: form.full_name.trim(),
        phone_number: form.phone_number.trim() || null,
        email: form.email.trim() || null,
        ubicacion: form.ubicacion.trim() || null,
        assigned_to_seller_id: userId,
        status: 'nuevo',
      });
      if (err) throw err;
      setForm({ full_name: '', phone_number: '', email: '', ubicacion: '' });
      setShow(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear');
    } finally {
      setBusy(false);
    }
  };

  const cambiarStatus = async (id: string, status: string) => {
    setError(null);
    const prev = rows;
    setRows(rs => rs.map(r => (r.id === id ? { ...r, status } : r)));
    try {
      const supabase = createClient();
      const { error: err } = await supabase.from('prospects').update({ status }).eq('id', id);
      if (err) throw err;
    } catch (err) {
      setRows(prev);
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el estado');
    }
  };

  const cotizarHref = (p: Prospect) => {
    const params = new URLSearchParams();
    if (p.full_name) params.set('nombre', p.full_name);
    if (p.phone_number) params.set('telefono', p.phone_number);
    if (p.ubicacion) params.set('ubicacion', p.ubicacion);
    return `/dashboard/cotizador?${params.toString()}`;
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <input
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full sm:w-64"
            placeholder="Buscar por nombre, teléfono, email…"
            value={q}
            onChange={e => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <select
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white capitalize"
            value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Todos los estados</option>
            {STATUSES.map(s => (
              <option key={s} value={s} className="capitalize">
                {s}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg"
        >
          {show ? 'Cancelar' : 'Nuevo prospecto'}
        </button>
      </div>

      {show && (
        <form
          onSubmit={crear}
          className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          <input
            required
            placeholder="Nombre completo"
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={form.full_name}
            onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
          />
          <input
            placeholder="Teléfono"
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={form.phone_number}
            onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))}
          />
          <input
            type="email"
            placeholder="Email"
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          />
          <input
            placeholder="Ubicación / liga de mapa"
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={form.ubicacion}
            onChange={e => setForm(f => ({ ...f, ubicacion: e.target.value }))}
          />
          <button
            type="submit"
            disabled={busy}
            className="sm:col-span-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg disabled:opacity-50"
          >
            Guardar
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : (
        <>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {pageRows.length === 0 ? (
              <p className="px-4 py-8 text-sm text-slate-500 text-center">
                {q || statusFilter !== 'all'
                  ? 'Sin resultados con esos filtros'
                  : 'Sin prospectos registrados'}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {pageRows.map(p => (
                  <li key={p.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">{p.full_name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {[p.phone_number, p.email].filter(Boolean).join(' · ') || 'Sin contacto'}
                        </p>
                        {p.ubicacion &&
                          (isUrl(p.ubicacion) ? (
                            <a
                              href={p.ubicacion}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-sky-600 hover:underline mt-0.5 inline-block"
                            >
                              Ver mapa ↗
                            </a>
                          ) : (
                            <p className="text-xs text-slate-400 mt-0.5">{p.ubicacion}</p>
                          ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={(p.status || 'nuevo').toLowerCase()}
                          onChange={e => void cambiarStatus(p.id, e.target.value)}
                          className={`text-xs px-2 py-1 rounded-full border-0 capitalize cursor-pointer ${
                            STATUS_STYLES[(p.status || 'nuevo').toLowerCase()] ||
                            'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {STATUSES.map(s => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <Link
                          href={`/dashboard/bitacora-comercial?prospectId=${p.id}`}
                          className="text-xs px-2.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-medium rounded-lg"
                        >
                          Seguimiento
                        </Link>
                        <Link
                          href={cotizarHref(p)}
                          className="text-xs px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg"
                        >
                          Cotizar
                        </Link>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-slate-600">
              <p>
                {filtered.length} prospecto{filtered.length === 1 ? '' : 's'} · página{' '}
                {currentPage} de {totalPages}
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
