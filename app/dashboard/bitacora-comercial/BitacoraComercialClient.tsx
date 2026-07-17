'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type FollowUp = {
  id: string;
  interaction_type: string;
  notes: string;
  next_follow_up_date: string | null;
  created_at: string;
  prospect: { full_name: string; ubicacion: string | null } | null;
  client: { full_name: string } | null;
  seller: { full_name: string } | null;
};

type Opt = { id: string; full_name: string };

const TYPES = ['Visita', 'Llamada', 'Prospecto', 'Mensaje'] as const;
const PAGE_SIZE = 10;

function isUrl(s: string | null): s is string {
  if (!s) return false;
  try {
    new URL(s);
    return true;
  } catch {
    return false;
  }
}

export default function BitacoraComercialClient({
  userId,
  initialProspectId,
  initialClientId,
}: {
  userId: string;
  initialProspectId?: string | null;
  initialClientId?: string | null;
}) {
  const [rows, setRows] = useState<FollowUp[]>([]);
  const [prospects, setProspects] = useState<Opt[]>([]);
  const [clients, setClients] = useState<Opt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(!!initialProspectId || !!initialClientId);
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({
    entity_kind: initialClientId ? ('cliente' as const) : ('prospecto' as const),
    prospect_id: initialProspectId || '',
    client_id: initialClientId || '',
    interaction_type: 'Visita' as (typeof TYPES)[number],
    notes: '',
    next_follow_up_date: '',
  } as {
    entity_kind: 'prospecto' | 'cliente';
    prospect_id: string;
    client_id: string;
    interaction_type: (typeof TYPES)[number];
    notes: string;
    next_follow_up_date: string;
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const [fu, pr, cl] = await Promise.all([
        supabase
          .from('follow_ups')
          .select(
            'id, interaction_type, notes, next_follow_up_date, created_at, prospect:prospects(full_name, ubicacion), client:clients(full_name), seller:staff_users!seller_id(full_name)',
          )
          .order('created_at', { ascending: false })
          .limit(500),
        supabase.from('prospects').select('id, full_name').order('full_name').limit(500),
        supabase.from('clients').select('id, full_name').order('full_name').limit(500),
      ]);
      if (fu.error) throw fu.error;
      if (pr.error) throw pr.error;
      setRows((fu.data as unknown as FollowUp[]) || []);
      setProspects((pr.data as Opt[]) || []);
      // clients puede fallar por RLS; no es bloqueante
      if (!cl.error) setClients((cl.data as Opt[]) || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar bitácora');
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
      if (typeFilter !== 'all' && r.interaction_type !== typeFilter) return false;
      if (!s) return true;
      return (
        (r.prospect?.full_name || '').toLowerCase().includes(s) ||
        (r.client?.full_name || '').toLowerCase().includes(s) ||
        (r.notes || '').toLowerCase().includes(s) ||
        (r.seller?.full_name || '').toLowerCase().includes(s)
      );
    });
  }, [rows, q, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    const entityId = form.entity_kind === 'cliente' ? form.client_id : form.prospect_id;
    if (!entityId || !form.notes.trim()) {
      setError('Selecciona prospecto o cliente y agrega notas');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const payload: Record<string, unknown> = {
        seller_id: userId,
        interaction_type: form.interaction_type,
        notes: form.notes.trim(),
        next_follow_up_date: form.next_follow_up_date || null,
      };
      if (form.entity_kind === 'cliente') payload.client_id = form.client_id;
      else payload.prospect_id = form.prospect_id;

      const { error: err } = await supabase.from('follow_ups').insert(payload);
      if (err) throw err;
      setForm(f => ({
        ...f,
        prospect_id: '',
        client_id: '',
        interaction_type: 'Visita',
        notes: '',
        next_follow_up_date: '',
      }));
      setShow(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  };

  const preselectedName =
    (initialProspectId && prospects.find(p => p.id === initialProspectId)?.full_name) ||
    (initialClientId && clients.find(c => c.id === initialClientId)?.full_name) ||
    null;

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
            placeholder="Buscar por prospecto, cliente, notas…"
            value={q}
            onChange={e => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <select
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
            value={typeFilter}
            onChange={e => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Todos los tipos</option>
            {TYPES.map(t => (
              <option key={t} value={t}>
                {t === 'Prospecto' ? 'Prospecto nuevo' : t}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg"
        >
          {show ? 'Cancelar' : 'Nuevo seguimiento'}
        </button>
      </div>

      {show && (
        <form onSubmit={crear} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          {preselectedName && (
            <div className="bg-sky-50 border border-sky-200 rounded-lg px-3 py-2 text-sm text-sky-800">
              Registrando seguimiento para{' '}
              {initialClientId ? 'cliente' : 'prospecto'}:{' '}
              <strong>{preselectedName}</strong>
            </div>
          )}
          <div className="flex gap-2">
            {(['prospecto', 'cliente'] as const).map(kind => (
              <button
                key={kind}
                type="button"
                onClick={() => setForm(f => ({ ...f, entity_kind: kind }))}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize ${
                  form.entity_kind === kind
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {kind}
              </button>
            ))}
          </div>
          {form.entity_kind === 'prospecto' ? (
            <select
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={form.prospect_id}
              onChange={e => setForm(f => ({ ...f, prospect_id: e.target.value }))}
            >
              <option value="">Seleccionar prospecto…</option>
              {prospects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          ) : (
            <select
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={form.client_id}
              onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
            >
              <option value="">Seleccionar cliente…</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          )}
          <select
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={form.interaction_type}
            onChange={e =>
              setForm(f => ({
                ...f,
                interaction_type: e.target.value as (typeof TYPES)[number],
              }))
            }
          >
            {TYPES.map(t => (
              <option key={t} value={t}>
                {t === 'Prospecto' ? 'Prospecto nuevo' : t}
              </option>
            ))}
          </select>
          <textarea
            required
            rows={3}
            placeholder="Notas"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          />
          <label className="block text-xs text-slate-600">
            Próximo seguimiento
            <input
              type="date"
              className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={form.next_follow_up_date}
              onChange={e => setForm(f => ({ ...f, next_follow_up_date: e.target.value }))}
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 bg-rose-600 text-white text-sm font-medium rounded-lg disabled:opacity-50"
          >
            Guardar
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : (
        <>
          <ul className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
            {pageRows.length === 0 ? (
              <li className="px-4 py-6 text-sm text-slate-500 text-center">
                {q || typeFilter !== 'all' ? 'Sin resultados con esos filtros' : 'Sin seguimientos'}
              </li>
            ) : (
              pageRows.map(r => (
                <li key={r.id} className="px-4 py-3">
                  <div className="flex justify-between gap-2">
                    <p className="text-sm font-medium text-slate-800">
                      {r.client?.full_name || r.prospect?.full_name || 'Sin contacto'}
                      <span
                        className={`ml-2 text-[11px] px-2 py-0.5 rounded-full font-medium ${
                          r.client ? 'bg-rose-100 text-rose-700' : 'bg-sky-100 text-sky-700'
                        }`}
                      >
                        {r.client ? 'Cliente' : 'Prospecto'}
                      </span>
                      <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                        {r.interaction_type}
                      </span>
                    </p>
                    <span className="text-xs text-slate-400 shrink-0">
                      {new Date(r.created_at).toLocaleDateString('es-MX')}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{r.notes}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {r.seller?.full_name || '—'}
                    {r.next_follow_up_date ? ` · próximo ${r.next_follow_up_date}` : ''}
                    {isUrl(r.prospect?.ubicacion ?? null) && (
                      <>
                        {' · '}
                        <a
                          href={r.prospect!.ubicacion!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-600 hover:underline"
                        >
                          Ver mapa ↗
                        </a>
                      </>
                    )}
                  </p>
                </li>
              ))
            )}
          </ul>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-slate-600">
              <p>
                {filtered.length} registro{filtered.length === 1 ? '' : 's'} · página {currentPage}{' '}
                de {totalPages}
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
