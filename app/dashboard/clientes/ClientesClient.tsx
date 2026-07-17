'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  EyeIcon,
  PencilSquareIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { createClient } from '@/lib/supabase/client';

type Client = {
  id: string;
  full_name: string;
  phone_number: string | null;
  email: string | null;
  status: string;
  created_at: string;
};

function formatDate(dateString: string | null) {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'Fecha inválida';
  }
}

function statusBadgeClass(status: string) {
  if (status === 'activo') return 'bg-green-100 text-green-900';
  if (status === 'potencial') return 'bg-yellow-100 text-yellow-900';
  return 'bg-red-100 text-red-900';
}

export default function ClientesClient() {
  const [rows, setRows] = useState<Client[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from('clients')
        .select('id, full_name, phone_number, email, status, created_at')
        .order('created_at', { ascending: false })
        .limit(500);
      if (err) throw err;
      setRows((data as Client[]) || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = rows.filter(r => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (
      r.full_name.toLowerCase().includes(s) ||
      (r.phone_number || '').includes(s) ||
      (r.email || '').toLowerCase().includes(s)
    );
  });

  const handleDelete = async (clientId: string, clientName: string) => {
    setActionError(null);
    if (
      !window.confirm(
        `¿Estás seguro de que quieres eliminar a "${clientName}"? Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }

    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase.from('clients').delete().eq('id', clientId);
      if (deleteError) throw deleteError;
      setRows(prev => prev.filter(c => c.id !== clientId));
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err.code === '23503') {
        setActionError(
          `Error: No se puede eliminar a "${clientName}" porque tiene créditos u otros registros asociados.`,
        );
      } else {
        setActionError(`Error al eliminar el cliente: ${err.message || 'desconocido'}`);
      }
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}
      {actionError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {actionError}
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center justify-between">
        <input
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full sm:w-72"
          placeholder="Buscar por nombre, teléfono o email…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <Link
          href="/dashboard/clientes/nuevo"
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg"
        >
          + Agregar Cliente
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : (
        <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Nombre</th>
                <th className="px-4 py-2.5 font-semibold">Teléfono</th>
                <th className="px-4 py-2.5 font-semibold">Email</th>
                <th className="px-4 py-2.5 font-semibold">Estatus</th>
                <th className="px-4 py-2.5 font-semibold">Registrado</th>
                <th className="px-4 py-2.5 font-semibold text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    Sin clientes
                  </td>
                </tr>
              ) : (
                filtered.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{c.full_name}</td>
                    <td className="px-4 py-2.5 text-slate-600">{c.phone_number || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-600">{c.email || '—'}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`px-2 py-1 font-semibold leading-tight rounded-full text-xs capitalize ${statusBadgeClass(c.status)}`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{formatDate(c.created_at)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          href={`/dashboard/clientes/${c.id}`}
                          title="Ver detalles"
                          className="p-1 text-blue-600 rounded-full hover:bg-blue-50"
                        >
                          <EyeIcon className="w-5 h-5" />
                        </Link>
                        <Link
                          href={`/dashboard/clientes/${c.id}/editar`}
                          title="Editar"
                          className="p-1 text-amber-600 rounded-full hover:bg-amber-50"
                        >
                          <PencilSquareIcon className="w-5 h-5" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => void handleDelete(c.id, c.full_name)}
                          title="Eliminar"
                          className="p-1 text-red-600 rounded-full hover:bg-red-50"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
