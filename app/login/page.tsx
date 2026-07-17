'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { rutaInicio, tieneAccesoPortal } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError('Correo electrónico o contraseña incorrectos.');
      setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError('Error de autenticación.');
      setLoading(false);
      return;
    }

    const { data: staffUser, error: staffError } = await supabase
      .from('staff_users')
      .select('role, is_active')
      .eq('id', user.id)
      .single();

    if (staffError || !staffUser) {
      await supabase.auth.signOut();
      setError('Tu usuario no está registrado en staff_users.');
      setLoading(false);
      return;
    }

    if (!staffUser.is_active || !tieneAccesoPortal(staffUser.role)) {
      await supabase.auth.signOut();
      setError(`Sin acceso (rol: ${staffUser.role ?? 'sin rol'}). Contacta al administrador.`);
      setLoading(false);
      return;
    }

    router.push(rutaInicio(staffUser.role));
    router.refresh();
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 px-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-xl">
          <div className="flex justify-center">
            <img
              src="/logo.svg"
              alt="Logo Grupo Castro Acero"
              className="h-24 w-auto max-w-sm mb-0 mx-auto block"
            />
          </div>
        <h2 className="text-2xl font-bold text-center text-gray-800">Iniciar Sesión</h2>
        <p className="text-sm text-center text-gray-500">Portal Interno Grupo Castro Acero</p>

        <form className="space-y-6" onSubmit={handleLogin}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Correo Electrónico
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-rose-700 focus:border-rose-700 sm:text-sm"
              placeholder="tu@correo.com"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-rose-700 focus:border-rose-700 sm:text-sm"
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="button"
            disabled={loading}
            onClick={async () => {
              if (!email.trim()) {
                setError('Escribe tu correo para recuperar la contraseña.');
                return;
              }
              setError(null);
              setLoading(true);
              try {
                const supabase = createClient();
                const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                  redirectTo: `${window.location.origin}/set-password`,
                });
                if (resetError) throw resetError;
                alert('Te enviamos un correo para restablecer la contraseña.');
              } catch {
                setError('No se pudo enviar el correo de recuperación.');
              } finally {
                setLoading(false);
              }
            }}
            className="w-full text-sm text-rose-700 hover:text-rose-900"
          >
            ¿Olvidaste tu contraseña?
          </button>

          <button
            type="submit"
            disabled={loading}
            className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
              loading ? 'bg-rose-300' : 'bg-rose-800 hover:bg-rose-900'
            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-700`}
          >
            {loading ? 'Ingresando…' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}
