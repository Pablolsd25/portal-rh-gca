'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const handleSetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage('');

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setMessage('¡Contraseña actualizada con éxito! Serás redirigido al login.');
      setTimeout(() => {
        router.push('/login');
      }, 2500);
    } catch {
      setError('No se pudo actualizar la contraseña. Abre el enlace del correo e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-800">Establecer contraseña</h1>
          <p className="text-sm text-slate-500 mt-1">Crea una contraseña para tu cuenta del Portal GCA</p>
        </div>
        <form onSubmit={handleSetPassword} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Nueva contraseña
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading || !!message}
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              placeholder="Mínimo 6 caracteres"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Confirmar contraseña
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              disabled={loading || !!message}
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </label>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          {message && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              {message}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || !!message}
            className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Guardando…' : 'Guardar contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
}
