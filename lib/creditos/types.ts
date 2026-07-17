export type CreditStatus =
  | 'pendiente'
  | 'activo'
  | 'rechazado'
  | 'pagado'
  | 'refinanciado';

export type CreditType = 'por_plazo' | 'mensual';

export type InterestMode = 'auto' | 'manual';

export type PaymentMethod = 'efectivo' | 'transferencia' | 'otro';

export type Credit = {
  id: string;
  client_id: string;
  status: CreditStatus;
  requested_amount: number;
  total_amount_due: number;
  weekly_payment_amount: number | null;
  payment_term_weeks: number | null;
  interest_rate: number | null;
  monthly_interest_rate: number | null;
  credit_type: CreditType | string | null;
  start_date: string | null;
  created_at: string;
  approved_or_rejected_at: string | null;
  refinanced_from_credit_id: string | null;
  initiated_by_staff_id: string | null;
  approved_by_staff_id: string | null;
  notes: string | null;
  clients?: { id: string; full_name: string; phone_number?: string | null } | null;
};

export type CreditProduct = {
  id: string;
  credit_id: string;
  quantity: number;
  unit: string;
  description: string;
  unit_price: number;
  subtotal: number;
};

export type CreditPayment = {
  id: string;
  credit_id: string;
  payment_date: string;
  amount_paid: number;
  payment_method: string;
  notes: string | null;
  registered_by_staff_id: string;
  staff_users?: { full_name: string } | null;
};

export type CreditDocument = {
  id: string;
  client_id: string;
  credit_id: string | null;
  document_type: string;
  file_name: string;
  file_path: string;
  verification_status: string;
  created_at: string;
};

export type MaterialItem = {
  id: string;
  quantity: string;
  unit: string;
  description: string;
  unitPrice: string;
  subtotal: number;
};

export type CalculatedTotals = {
  subtotal: number;
  interest: number;
  downPayment: number;
  totalDue: number;
  weeklyPayment: number;
  interestRatePercent: number;
};

export type DocTypeDef = { id: string; label: string };
