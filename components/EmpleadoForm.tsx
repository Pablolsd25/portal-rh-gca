'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Empleado } from '@/lib/types';

interface Props {
  empleado?: Empleado;
}

export default function EmpleadoForm({ empleado }: Props) {
  const router = useRouter();
  const isEdit = !!empleado;

  const [nombre, setNombre] = useState(empleado?.nombre ?? '');
  const [puesto, setPuesto] = useState(empleado?.puesto ?? '');
  const [sueldo, setSueldo] = useState(String(empleado?.sueldo_base_semanal ?? ''));
  const [activo, setActivo] = useState(empleado?.activo ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const payload = {
      nombre: nombre.trim(),
      puesto: puesto.trim(),
      sueldo_base_semanal: parseFloat(sueldo),
      activo,
      updated_at: new Date().toISOString(),
    };

    let err;
    if (isEdit) {
      ({ error: err } = await supabase.from('empleados').update(payload).eq('id', empleado.id));
    } else {
      ({ error: err } = await supabase.from('empleados').insert(payload));
    }

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    router.push('/dashboard/empleados');
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 max-w-lg space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre completo</label>
        <input
          required
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder="Nombre del empleado"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Puesto</label>
        <input
          required
          value={puesto}
          onChange={e => setPuesto(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder="Ej: Operador, Ayudante, Doblador"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Sueldo base semanal ($)</label>
        <input
          required
          type="number"
          min="0"
          step="0.01"
          value={sueldo}
          onChange={e => setSueldo(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder="0.00"
        />
      </div>

      {isEdit && (
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="activo"
            checked={activo}
            onChange={e => setActivo(e.target.checked)}
            className="w-4 h-4 text-emerald-600 rounded border-slate-300"
          />
          <label htmlFor="activo" className="text-sm text-slate-700">Empleado activo</label>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-300 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {loading ? 'Guardando...' : isEdit ? 'Actualizar' : 'Crear empleado'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
