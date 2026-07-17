export type QuoteStatus =
  | 'borrador'
  | 'enviada'
  | 'aceptada'
  | 'en_revision_pago'
  | 'venta_concretada'
  | 'pendiente_pago_mostrador'
  | 'a_credito'
  | 'por_definir'
  | 'rechazada'
  | 'pagada';

export type PaymentProfileType = 'ADRIAN_CASTRO' | 'SIGLO_XXI';

export type PaymentMethod =
  | 'efectivo'
  | 'tarjeta_credito'
  | 'tarjeta_debito'
  | 'transferencia'
  | 'deposito'
  | 'pago_en_mostrador'
  | 'credito'
  | 'por_definir';

export type EntregaBadge = 'pendiente_bascula' | 'programada' | 'en_ruta';

export interface QuoteItem {
  id?: string;
  quote_id?: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  subtotal_item: number;
  product_id?: string | null;
}

export interface QuotePaymentProof {
  id: string;
  quote_id: string;
  file_path: string | null;
  file_name: string | null;
  amount_paid: number | null;
  reference_number: string | null;
  uploaded_by: string | null;
  uploaded_at?: string | null;
  complement_uploaded_at?: string | null;
  complement_file_url?: string | null;
  complement_file_name?: string | null;
}

export interface FrequentClient {
  id: string;
  full_name: string;
  phone_number: string | null;
  address: string | null;
  seller_id: string | null;
}

export interface QuoteClient {
  full_name: string;
  phone_number?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_neighborhood?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_postal_code?: string | null;
}

export interface EntregaProgramada {
  revisado_bascula: boolean;
  fecha_entrega: string | null;
}

export interface Quote {
  id: string;
  quote_date: string;
  client_id: string | null;
  client_name_temporary: string | null;
  client_phone_temporary: string | null;
  delivery_address: string | null;
  payment_profile_type: PaymentProfileType | string | null;
  payment_method: string | null;
  seller_id: string | null;
  created_by_staff_id?: string | null;
  subtotal: number;
  iva_amount: number;
  total_amount: number;
  status: QuoteStatus;
  notes: string | null;
  requires_invoice: boolean | null;
  uso_cfdi: string | null;
  metodo_de_pago_cfdi: string | null;
  forma_de_pago_cfdi: string | null;
  numero_factura?: string | null;
  ppd_descartado?: boolean | null;
  sucursal: string | null;
  payment_confirmed_at: string | null;
  payment_confirmed_by: string | null;
  created_at?: string;
  updated_at?: string;
  clients?: QuoteClient | null;
  vendedor?: { full_name: string } | null;
  confirmador?: { full_name: string } | null;
  quote_payment_proofs?: QuotePaymentProof[];
  quote_items?: QuoteItem[];
  items?: QuoteItem[];
  entregas_programadas?: EntregaProgramada | EntregaProgramada[] | null;
}

export interface QuoteInput {
  client_id?: string | null;
  client_name_temporary?: string | null;
  client_phone_temporary?: string | null;
  delivery_address?: string | null;
  payment_profile_type?: PaymentProfileType | string | null;
  seller_id: string;
  created_by_staff_id?: string;
  subtotal: number;
  iva_amount: number;
  total_amount: number;
  status: QuoteStatus;
  notes?: string | null;
  requires_invoice?: boolean;
  uso_cfdi?: string | null;
  metodo_de_pago_cfdi?: string | null;
  forma_de_pago_cfdi?: string | null;
  sucursal?: string | null;
}

export interface QuoteItemInput {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  subtotal_item: number;
  product_id?: string | null;
}

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  aceptada: 'Aceptada',
  en_revision_pago: 'En revisión de pago',
  venta_concretada: 'Venta concretada',
  pendiente_pago_mostrador: 'Pendiente pago mostrador',
  a_credito: 'A crédito',
  por_definir: 'Por definir',
  rechazada: 'Rechazada',
  pagada: 'Pagada',
};

export const STATUS_BADGE_CLASS: Record<QuoteStatus, string> = {
  borrador: 'bg-slate-100 text-slate-600',
  enviada: 'bg-blue-100 text-blue-800',
  aceptada: 'bg-green-100 text-green-800',
  en_revision_pago: 'bg-cyan-100 text-cyan-800',
  venta_concretada: 'bg-purple-100 text-purple-800',
  pendiente_pago_mostrador: 'bg-yellow-100 text-yellow-800',
  a_credito: 'bg-orange-100 text-orange-800',
  por_definir: 'bg-slate-100 text-slate-600',
  rechazada: 'bg-red-100 text-red-800',
  pagada: 'bg-green-100 text-green-800',
};

export const IVA_RATE = 0.16;
