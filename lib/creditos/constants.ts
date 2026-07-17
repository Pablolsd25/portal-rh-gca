import type { DocTypeDef } from './types';

export const PLAZO_MAXIMO_SEMANAS = 16;
export const PLAZO_INICIAL_SEMANAS = 12;
export const BUCKET_DOCS = 'documentos-creditos';

export const UPLOADABLE_DOCS: DocTypeDef[] = [
  { id: 'identificacion_oficial', label: 'Identificación Oficial (INE/Pasaporte)' },
  { id: 'comprobante_domicilio', label: 'Comprobante de Domicilio (< 3 meses)' },
  { id: 'comprobante_predio', label: 'Comprobante de Pago de Predio' },
  { id: 'comprobante_ingresos', label: 'Comprobante de Ingresos' },
  { id: 'pagare_firmado', label: 'Pagaré Firmado (Escaneado/Foto)' },
  { id: 'contrato_firmado', label: 'Contrato de Crédito Firmado (Escaneado/Foto)' },
];

export function getAutoInterestRate(weeks: number): number {
  if (weeks >= 4 && weeks <= 6) return 0.25;
  if (weeks >= 7 && weeks <= 10) return 0.3;
  if (weeks >= 11 && weeks <= 16) return 0.45;
  return 0.45;
}

export function createMaterialItem() {
  return {
    id: crypto.randomUUID(),
    quantity: '',
    unit: '',
    description: '',
    unitPrice: '',
    subtotal: 0,
  };
}
