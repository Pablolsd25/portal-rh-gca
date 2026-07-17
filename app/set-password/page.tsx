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
      setTimeout(() => router.push('/login'), 2500);
    } catch {
      setError('No se pudo actualizar la contraseña. Abre el enlace del correo e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 px-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-xl">
        <div className="flex justify-center">
          <img src="/logo.svg" alt="GCA" className="h-20 w-auto" />
        </div>
        <h2 className="text-2xl font-bold text-center text-gray-800">Establecer Contraseña</h2>
        <p className="text-sm text-center text-gray-500">Crea una contraseña para tu cuenta.</p>
        <form className="space-y-6" onSubmit={handleSetPassword}>
          <div>
            <label className="block text-sm font-medium text-gray-700">Nueva Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading || !!message}
              className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-rose-700 focus:border-rose-700 sm:text-sm"
              placeholder="•••••••• (mín. 6 caracteres)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Confirmar Contraseña</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              disabled={loading || !!message}
              className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-rose-700 focus:border-rose-700 sm:text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-green-600">{message}</p>}
          <button
            type="submit"
            disabled={loading || !!message}
            className={`w-full flex justify-center py-2 px-4 rounded-md shadow-sm text-sm font-medium text-white ${
              loading || message ? 'bg-rose-300' : 'bg-rose-800 hover:bg-rose-900'
            }`}
          >
            {loading ? 'Guardando…' : 'Guardar Contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
}
