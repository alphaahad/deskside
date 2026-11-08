import { invoices } from "./data/seed";

/** "4471", "inv 4471", "INV-4471" or the vendor's own number ("HSS-INV-3392") → INV-4471. Pure. */
export function resolveInvoiceRef(ref: string | undefined | null): string | null {
  if (!ref) return null;
  const s = String(ref).trim();
  const byNumber = invoices.find((i) => s.toLowerCase().includes(i.number.toLowerCase()));
  if (byNumber) return byNumber.id;
  const digits = s.match(/\b(44\d{2})\b/);
  if (digits && invoices.some((i) => i.id === `INV-${digits[1]}`)) return `INV-${digits[1]}`;
  return null;
}
