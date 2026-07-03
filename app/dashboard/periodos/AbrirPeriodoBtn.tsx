'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AbrirPeriodoBtn({ fechaInicio, fechaFin }: { fechaInicio: string; fechaFin: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [inicio, setInicio] = useState(fechaInicio);
  const [fin, setFin] = useState(fechaFin);
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAbrir = async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabase.from('periodos_nomina').insert({
      fecha_inicio: inicio,
      fecha_fin: fin,
      estado: 'abierto',
      creado_por: user?.id,
    });
    if (err) { setError(err.message); setLoading(false); return; }
    setShow(false);
    router.refresh();
    setLoading(false);
  };

  return (
    <>
      <button
        onClick={() => setShow(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium rounded-lg transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Abrir nuevo periodo
      </button>

      {show && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-800">Nuevo periodo de nómina</h2>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fecha inicio (viernes)</label>
              <input type="date" value={inicio} onChange={e => setInicio(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fecha fin (jueves)</label>
              <input type="date" value={fin} onChange={e => setFin(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button onClick={handleAbrir} disabled={loading}
                className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-300 text-white text-sm font-medium rounded-lg transition-colors">
                {loading ? 'Abriendo...' : 'Confirmar'}
              </button>
              <button onClick={() => setShow(false)}
                className="flex-1 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
