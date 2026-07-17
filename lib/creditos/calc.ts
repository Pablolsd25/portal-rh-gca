import { getAutoInterestRate } from './constants';
import type {
  CalculatedTotals,
  Credit,
  CreditPayment,
  CreditType,
  InterestMode,
  MaterialItem,
} from './types';

function round2(n: number) {
  return parseFloat(n.toFixed(2));
}

/** Staff: weekly payment is on principal; interest (por_plazo) is suggested down payment. */
export function calcCreditTotals(opts: {
  materialItems: MaterialItem[];
  creditType: CreditType;
  paymentTermWeeks: number;
  interestMode: InterestMode;
  manualInterestRate: string;
  paymentTermMonths: number;
  monthlyInterestRate: string;
  /** Outstanding balance rolled into a refinance */
  originalBalance?: number;
}): CalculatedTotals {
  const {
    materialItems,
    creditType,
    paymentTermWeeks,
    interestMode,
    manualInterestRate,
    paymentTermMonths,
    monthlyInterestRate,
    originalBalance = 0,
  } = opts;

  const newMaterialsSubtotal = materialItems.reduce(
    (sum, item) => sum + (item.subtotal || 0),
    0,
  );
  const baseAmount = newMaterialsSubtotal;
  let rateDecimal = 0;
  let interest = 0;

  if (creditType === 'mensual') {
    rateDecimal = parseFloat(monthlyInterestRate) / 100 || 0;
    interest = baseAmount * rateDecimal * paymentTermMonths;
  } else {
    rateDecimal =
      interestMode === 'manual'
        ? parseFloat(manualInterestRate) / 100 || 0
        : getAutoInterestRate(paymentTermWeeks);
    interest = baseAmount * rateDecimal;
  }

  // Interest only applies to new materials; prior balance rolls in as-is.
  let totalDue = baseAmount + interest;
  let subtotal = newMaterialsSubtotal;
  if (originalBalance > 0) {
    subtotal = originalBalance + newMaterialsSubtotal;
    totalDue = originalBalance + totalDue;
  }

  const finalWeeks =
    creditType === 'por_plazo' ? paymentTermWeeks : paymentTermMonths * 4;
  // Principal (subtotal) / weeks — enganche (interés por_plazo) assumed paid up front.
  const weeklyPayment = finalWeeks > 0 ? subtotal / finalWeeks : 0;

  return {
    subtotal: round2(subtotal),
    interest: round2(interest),
    downPayment: creditType === 'por_plazo' ? round2(interest) : 0,
    totalDue: round2(totalDue),
    weeklyPayment: round2(weeklyPayment),
    interestRatePercent: round2(rateDecimal * 100),
  };
}

export function sumPayments(payments: Pick<CreditPayment, 'amount_paid'>[]): number {
  return payments.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);
}

export function outstandingBalance(
  totalAmountDue: number,
  payments: Pick<CreditPayment, 'amount_paid'>[],
): number {
  return round2(Math.max(0, (Number(totalAmountDue) || 0) - sumPayments(payments)));
}

/**
 * Consolidated pending balance for a credit that may be a refinance.
 * For refinances: totalDebt = originalTotal + newCharges, then subtract all payments.
 */
export function calcConsolidatedBalance(opts: {
  credit: Pick<Credit, 'total_amount_due' | 'refinanced_from_credit_id'>;
  payments: Pick<CreditPayment, 'amount_paid'>[];
  originalCredit?: Pick<Credit, 'total_amount_due'> | null;
  originalPayments?: Pick<CreditPayment, 'amount_paid'>[];
}): number {
  const {
    credit,
    payments,
    originalCredit = null,
    originalPayments = [],
  } = opts;

  const newPaid = sumPayments(payments);
  const consolidatedDue = Number(credit.total_amount_due) || 0;

  if (originalCredit && credit.refinanced_from_credit_id) {
    const originalDue = Number(originalCredit.total_amount_due) || 0;
    const originalPaid = sumPayments(originalPayments);
    const outstandingOriginal = originalDue - originalPaid;
    const newCharges = consolidatedDue - outstandingOriginal;
    const totalDebt = originalDue + newCharges;
    const totalPaid = originalPaid + newPaid;
    return round2(totalDebt - totalPaid);
  }

  return round2(consolidatedDue - newPaid);
}

/** Eligible when active and payments made ≥ half the term (staff rule). */
export function isEligibleForRefinancing(
  credit: Pick<Credit, 'status' | 'payment_term_weeks'> | null | undefined,
  paymentsMadeCount: number,
): boolean {
  if (!credit || credit.status !== 'activo') return false;
  const weeks = Number(credit.payment_term_weeks) || 0;
  if (weeks <= 0) return false;
  return paymentsMadeCount >= weeks / 2;
}
