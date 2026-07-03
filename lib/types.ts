export type StaffRole = 'admin' | 'vendedor' | 'venta mostrador' | 'contabilidad' | 'rh' | 'logistica';

export interface StaffUser {
  id: string;
  full_name: string;
  email: string;
  role: StaffRole;
  is_active: boolean;
}

export interface Empleado {
  id: string;
  nombre: string;
  puesto: string;
  sueldo_base_semanal: number;
  activo: boolean;
  created_at: string;
}

export interface PeriodoNomina {
  id: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: 'abierto' | 'cerrado';
  creado_por: string | null;
  cerrado_por: string | null;
  created_at: string;
}

export interface BitacoraEmbarque {
  id: string;
  periodo_id: string;
  fecha: string;
  tipo_unidad: 'freightliner' | 'isuzu' | 'ford';
  operador_id: string;
  ayudante1_id: string | null;
  ayudante2_id: string | null;
  importe_operador: number;
  importe_ayudante1: number;
  importe_ayudante2: number;
  observaciones: string | null;
  operador?: Empleado;
  ayudante1?: Empleado;
  ayudante2?: Empleado;
}

export interface BonoDoblado {
  id: string;
  periodo_id: string;
  empleado_id: string;
  fecha: string;
  toneladas: number;
  importe: number;
  observaciones: string | null;
  empleado?: Empleado;
}

export interface BonoEnderezado {
  id: string;
  periodo_id: string;
  empleado_id: string;
  fecha: string;
  kilos: number;
  califica: boolean;
  importe: number;
  observaciones: string | null;
  empleado?: Empleado;
}

export interface BonoAnillos {
  id: string;
  periodo_id: string;
  empleado_id: string;
  fecha: string;
  kilos: number;
  importe: number;
  observaciones: string | null;
  empleado?: Empleado;
}

export interface BonoDescarga {
  id: string;
  periodo_id: string;
  empleado_id: string;
  fecha: string;
  tipo_vehiculo: 'trailer' | 'rabon' | 'camioneta';
  importe: number;
  observaciones: string | null;
  empleado?: Empleado;
}

export interface ProduccionExtra {
  id: string;
  periodo_id: string;
  empleado_id: string;
  fecha: string;
  concepto: string;
  importe: number;
  observaciones: string | null;
  empleado?: Empleado;
}

// Fila de nómina calculada para la vista semanal
export interface NominaRow {
  empleado: Empleado;
  sueldo_base: number;
  bonos_por_dia: Record<string, number>; // fecha ISO -> total bonos del día
  total_bonos: number;
  total: number;
}
