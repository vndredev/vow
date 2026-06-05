/** Hand-written logic, bound by vow "invoice-total" — the 10% escape hatch (vow doesn't generate this). */
export interface InvoiceInput {
  qty: number;
  unit: number;
}

/** Total price; a 5% staggered discount applies from 10 units. */
export function computeTotal(input: InvoiceInput): number {
  const gross = input.qty * input.unit;
  return input.qty >= 10 ? gross * 0.95 : gross;
}
