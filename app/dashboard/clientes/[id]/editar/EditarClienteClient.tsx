'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import ClienteForm, { type ClienteFormData } from '@/components/creditos/ClienteForm';

function uniqueConstraintMessage(message: string): string | null {
  if (message.includes('phone_number')) return 'El número de teléfono ya está registrado.';
  if (message.includes('email')) return 'El correo electrónico ya está registrado.';
  return null;
}

export default function EditarClienteClient({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [formData, setFormData] = useState<ClienteFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchClient = async () => {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const { data, error: fetchError } = await supabase
          .from('clients')
          .select('*')
          .eq('id', clientId)
          .single();
        if (fetchError) throw fetchError;
        if (!data) throw new Error('Cliente no encontrado.');
        if (cancelled) return;
        setFormData({
          id: data.id,
          full_name: data.full_name || '',
          phone_number: data.phone_number || '',
          email: data.email || '',
          address_street: data.address_street || '',
          address_number: data.address_number || '',
          address_neighborhood: data.address_neighborhood || '',
          address_city: data.address_city || '',
          address_state: data.address_state || '',
          address_postal_code: data.address_postal_code || '',
          status: data.status || 'potencial',
        });
      } catch (err) {
        if (!cancelled) {
          setError(`Error al cargar el cliente: ${err instanceof Error ? err.message : 'desconocido'}`);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchClient();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => (prev ? { ...prev, [name]: value } : prev));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData) return;
    setError(null);
    setSuccessMessage(null);
    setSaving(true);

    try {
      const supabase = createClient();
      const payload = {
        full_name: formData.full_name.trim(),
        phone_number: formData.phone_number.trim(),
        email: formData.email.trim() || null,
        address_street: formData.address_street.trim() || null,
        address_number: formData.address_number.trim() || null,
        address_neighborhood: formData.address_neighborhood.trim() || null,
        address_city: formData.address_city.trim() || null,
        address_state: formData.address_state.trim() || null,
        address_postal_code: formData.address_postal_code.trim() || null,
        status: formData.status,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('clients')
        .update(payload)
        .eq('id', clientId);

      if (updateError) {
        if (updateError.code === '23505') {
          const msg = uniqueConstraintMessage(updateError.message);
          throw new Error(msg || updateError.message);
        }
        throw updateError;
      }

      setSuccessMessage('¡Cliente actualizado con éxito!');
      setTimeout(() => {
        router.push(`/dashboard/clientes/${clientId}`);
      }, 1200);
    } catch (err) {
      setError(
        `Error al actualizar el cliente: ${err instanceof Error ? err.message : 'desconocido'}`,
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Cargando cliente…</p>;
  }

  if (error && !formData) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
        {error}
      </div>
    );
  }

  if (!formData) return null;

  return (
    <ClienteForm
      formData={formData}
      handleChange={handleChange}
      handleSubmit={handleSubmit}
      loading={saving}
      error={error}
      successMessage={successMessage}
      mode="edit"
      cancelHref={`/dashboard/clientes/${clientId}`}
    />
  );
}
