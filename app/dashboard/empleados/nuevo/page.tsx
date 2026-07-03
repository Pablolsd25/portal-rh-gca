import EmpleadoForm from '@/components/EmpleadoForm';

export default function NuevoEmpleadoPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Nuevo empleado</h1>
      <EmpleadoForm />
    </div>
  );
}
