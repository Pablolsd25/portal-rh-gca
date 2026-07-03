import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import EmpleadoForm from '@/components/EmpleadoForm';

export default async function EditarEmpleadoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: empleado } = await supabase.from('empleados').select('*').eq('id', id).single();

  if (!empleado) notFound();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Editar empleado</h1>
      <EmpleadoForm empleado={empleado} />
    </div>
  );
}
