'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownTrayIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { createClient } from '@/lib/supabase/client';
import { formatMoney } from '@/lib/ventas/quotes';

const BUCKET_NAME = 'documentos-creditos';

type Client = {
  id: string;
  full_name: string;
  phone_number: string | null;
  email: string | null;
  status: string;
  created_at: string;
  address_street: string | null;
  address_number: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_postal_code: string | null;
};

type Credit = {
  id: string;
  status: string;
  requested_amount: number;
  total_amount_due: number;
  credit_type: string | null;
  start_date: string | null;
  created_at: string;
};

type DocumentRow = {
  id: string;
  created_at: string;
  document_type: string;
  file_name: string;
  file_path: string;
  verification_status: string;
};

function statusBadgeClass(status: string) {
  if (status === 'activo') return 'bg-green-100 text-green-900';
  if (status === 'potencial') return 'bg-yellow-100 text-yellow-900';
  return 'bg-red-100 text-red-900';
}

function docStatusClass(status: string) {
  if (status === 'pendiente') return 'bg-yellow-100 text-yellow-800';
  if (status === 'verificado') return 'bg-green-100 text-green-800';
  if (status === 'rechazado') return 'bg-red-100 text-red-800';
  return 'bg-slate-100 text-slate-800';
}

export default function DetalleClienteClient({ clientId }: { clientId: string }) {
  const [client, setClient] = useState<Client | null>(null);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [docsError, setDocsError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDocsError(null);
    setLoadingDocs(true);

    try {
      const supabase = createClient();
      const [clientRes, creditsRes, docsRes] = await Promise.all([
        supabase.from('clients').select('*').eq('id', clientId).single(),
        supabase
          .from('credits')
          .select(
            'id, status, requested_amount, total_amount_due, credit_type, start_date, created_at',
          )
          .eq('client_id', clientId)
          .order('created_at', { ascending: false }),
        supabase
          .from('documents')
          .select(
            'id, created_at, document_type, file_name, file_path, verification_status',
          )
          .eq('client_id', clientId)
          .order('created_at', { ascending: false }),
      ]);

      if (clientRes.error) {
        if (clientRes.error.code === 'PGRST116') {
          throw new Error(`Cliente ${clientId} no encontrado.`);
        }
        throw clientRes.error;
      }

      setClient(clientRes.data as Client);
      if (creditsRes.error) throw creditsRes.error;
      setCredits((creditsRes.data as Credit[]) || []);

      if (docsRes.error) {
        setDocsError('No se pudieron cargar los documentos.');
      } else {
        setDocuments((docsRes.data as DocumentRow[]) || []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar el cliente');
    } finally {
      setLoading(false);
      setLoadingDocs(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-slate-500">Cargando información…</p>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
        {error}
      </div>
    );
  }

  if (!client) {
    return <p className="text-sm text-slate-500">No se encontró información para este cliente.</p>;
  }

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/clientes"
        className="inline-block text-sm text-rose-700 hover:underline"
      >
        ← Volver a la lista de Clientes
      </Link>

      <div className="p-6 bg-white border border-slate-200 rounded-xl">
        <div className="flex flex-col items-start justify-between mb-4 gap-3 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{client.full_name}</h1>
            <span
              className={`mt-2 inline-block px-2 py-1 text-xs font-semibold rounded-full capitalize ${statusBadgeClass(client.status)}`}
            >
              {client.status}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/dashboard/bitacora-comercial?clientId=${clientId}`}
              className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Registrar visita
            </Link>
            <Link
              href={`/dashboard/cotizador?nombre=${encodeURIComponent(client.full_name)}&telefono=${encodeURIComponent(client.phone_number || '')}`}
              className="px-3 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Nueva cotización
            </Link>
            <Link
              href={`/dashboard/creditos/nuevo?clientId=${clientId}`}
              className="px-3 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700"
            >
              Solicitar crédito
            </Link>
            <Link
              href={`/dashboard/clientes/${clientId}/editar`}
              className="px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Editar
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 text-sm">
          <p>
            <strong className="text-slate-600">Teléfono:</strong>{' '}
            <span className="text-slate-800">{client.phone_number || '—'}</span>
          </p>
          <p>
            <strong className="text-slate-600">Email:</strong>{' '}
            <span className="text-slate-800">{client.email || '—'}</span>
          </p>
          <p>
            <strong className="text-slate-600">Registrado:</strong>{' '}
            <span className="text-slate-800">
              {new Date(client.created_at).toLocaleDateString('es-MX')}
            </span>
          </p>
          <div className="md:col-span-2">
            <strong className="text-slate-600">Dirección:</strong>
            <address className="mt-1 text-slate-800 not-italic">
              {[client.address_street, client.address_number].filter(Boolean).join(' ') || '—'}
              <br />
              {client.address_neighborhood || ''}
              <br />
              {[client.address_postal_code, client.address_city].filter(Boolean).join(' ')}
              <br />
              {client.address_state || ''}
            </address>
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-700">Historial de Créditos</h2>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {credits.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Sin créditos registrados para este cliente.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {credits.map(c => (
                <li key={c.id} className="px-4 py-3 flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800 capitalize">
                      {c.credit_type || 'por_plazo'} · {c.status}
                    </p>
                    <p className="text-xs text-slate-500">
                      Solicitado {formatMoney(c.requested_amount)} · Due{' '}
                      {formatMoney(c.total_amount_due)}
                      {c.start_date
                        ? ` · Inicio ${new Date(c.start_date).toLocaleDateString('es-MX')}`
                        : ''}
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/creditos/${c.id}`}
                    className="text-xs text-rose-700 hover:underline self-center"
                  >
                    Ver crédito
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-700">Documentos Asociados</h2>
        <div className="p-4 bg-white border border-slate-200 rounded-xl">
          {loadingDocs && <p className="text-sm text-slate-500">Cargando documentos…</p>}
          {docsError && <p className="text-sm text-red-600">{docsError}</p>}
          {!loadingDocs && !docsError && (
            <>
              {documents.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No hay documentos registrados para este cliente.
                </p>
              ) : (
                <DocumentList documents={documents} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DocumentList({ documents }: { documents: DocumentRow[] }) {
  const supabase = createClient();

  return (
    <ul className="space-y-3">
      {documents.map(doc => {
        const { data: urlData } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(doc.file_path);
        const publicURL = urlData?.publicUrl;
        const uploadDate = doc.created_at
          ? new Date(doc.created_at).toLocaleString('es-MX', {
              dateStyle: 'short',
              timeStyle: 'short',
            })
          : 'N/A';

        return (
          <li
            key={doc.id}
            className="flex flex-col p-3 border border-slate-200 rounded-lg sm:flex-row sm:items-center sm:justify-between bg-slate-50"
          >
            <div className="flex items-center flex-grow mb-2 mr-2 sm:mb-0">
              <DocumentTextIcon className="w-5 h-5 mr-2 text-slate-500 shrink-0" />
              <div className="min-w-0">
                <span className="block text-sm font-medium text-slate-800 capitalize">
                  {doc.document_type.replace(/_/g, ' ')}
                </span>
                <span className="block text-xs text-slate-500 truncate" title={doc.file_name}>
                  {doc.file_name}
                </span>
                <span className="block text-xs text-slate-400">Subido: {uploadDate}</span>
              </div>
            </div>
            <div className="flex items-center self-end gap-2 shrink-0 sm:self-center">
              <span
                className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${docStatusClass(doc.verification_status)}`}
              >
                {doc.verification_status}
              </span>
              {publicURL ? (
                <a
                  href={publicURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Abrir documento"
                  className="p-1 text-blue-600 rounded-full hover:bg-blue-100"
                >
                  <ArrowDownTrayIcon className="w-5 h-5" />
                </a>
              ) : (
                <span title="No se pudo generar URL" className="p-1 text-slate-400 cursor-not-allowed">
                  <ArrowDownTrayIcon className="w-5 h-5" />
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
