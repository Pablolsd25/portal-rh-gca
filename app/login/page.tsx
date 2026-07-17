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
      setError('Correo o contraseña incorrectos.');
      setLoading(false);
      return;
    }

    // Verificar que el usuario tenga rol rh o admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('Error de autenticación.'); setLoading(false); return; }

    const { data: staffUser, error: staffError } = await supabase
      .from('staff_users')
      .select('role, is_active')
      .eq('id', user.id)
      .single();

    if (staffError || !staffUser) {
      await supabase.auth.signOut();
      setError('Tu usuario no está registrado en staff_users. Ejecuta el SQL de Humberto en Supabase.');
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-4">
            <svg className="w-8 h-8 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Portal GCA</h1>
          <p className="text-sm text-slate-500 mt-1">Sistema integral · Grupo Castro Acero</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Correo electrónico</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50"
              placeholder="tu@correo.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

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
                const origin = window.location.origin;
                const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                  redirectTo: `${origin}/set-password`,
                });
                if (resetError) throw resetError;
                setError(null);
                alert('Te enviamos un correo para restablecer la contraseña.');
              } catch {
                setError('No se pudo enviar el correo de recuperación.');
              } finally {
                setLoading(false);
              }
            }}
            className="w-full text-sm text-emerald-700 hover:text-emerald-800"
          >
            ¿Olvidaste tu contraseña?
          </button>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-300 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
