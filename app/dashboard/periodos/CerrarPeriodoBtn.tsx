'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function CerrarPeriodoBtn({ periodoId }: { periodoId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleCerrar = async () => {
    if (!confirm('¿Cerrar este periodo? No se podrán editar los registros una vez cerrado.')) return;
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('periodos_nomina').update({ estado: 'cerrado', cerrado_por: user?.id }).eq('id', periodoId);
    router.refresh();
    setLoading(false);
  };

  return (
    <button
      onClick={handleCerrar}
      disabled={loading}
      className="text-xs text-red-600 hover:underline disabled:opacity-50"
    >
      {loading ? 'Cerrando...' : 'Cerrar'}
    </button>
  );
}
