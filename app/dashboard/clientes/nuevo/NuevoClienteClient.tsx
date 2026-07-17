'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import ClienteForm, { type ClienteFormData } from '@/components/creditos/ClienteForm';

const initialState: ClienteFormData = {
  full_name: '',
  phone_number: '',
  email: '',
  address_street: '',
  address_number: '',
  address_neighborhood: '',
  address_city: 'Tecámac de Felipe Villanueva',
  address_state: 'Estado de México',
  address_postal_code: '',
  status: 'potencial',
};

function uniqueConstraintMessage(message: string): string | null {
  if (message.includes('phone_number')) return 'El número de teléfono ya está registrado.';
  if (message.includes('email')) return 'El correo electrónico ya está registrado.';
  return null;
}

export default function NuevoClienteClient({ userId }: { userId: string }) {
  const router = useRouter();
  const [formData, setFormData] = useState<ClienteFormData>(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!formData.full_name.trim() || !formData.phone_number.trim()) {
      setError('El nombre completo y el número de teléfono son obligatorios.');
      return;
    }

    setLoading(true);
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
        status: formData.status || 'potencial',
        registered_by_staff_id: userId,
      };

      const { error: insertError } = await supabase.from('clients').insert([payload]);

      if (insertError) {
        if (insertError.code === '23505') {
          const msg = uniqueConstraintMessage(insertError.message);
          throw new Error(msg || insertError.message);
        }
        throw insertError;
      }

      setSuccessMessage('¡Cliente agregado con éxito!');
      setFormData(initialState);
      setTimeout(() => {
        router.push('/dashboard/clientes');
      }, 1200);
    } catch (err) {
      setError(`Error al agregar cliente: ${err instanceof Error ? err.message : 'desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ClienteForm
      formData={formData}
      handleChange={handleChange}
      handleSubmit={handleSubmit}
      loading={loading}
      error={error}
      successMessage={successMessage}
      mode="add"
      cancelHref="/dashboard/clientes"
    />
  );
}
