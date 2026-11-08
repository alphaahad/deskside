// What a perfect read of each mock PDF returns. Used as the labelled "fallback" when no model is
// available, to score the model's reads, and by the tests.
import type { Extraction, SeedInvoice } from "../types";
import { purchaseOrders, receipts, paidBills, vendors, vendorOf } from "./seed";
import type { MatchInput } from "../match";

export function truthExtraction(inv: SeedInvoice): Extraction {
  const v = vendorOf(inv.vendorId);
  return {
    vendor_name: v.name,
    vendor_gstin: v.gstin,
    invoice_number: inv.number,
    invoice_date: inv.date,
    po_number: inv.poId,
    lines: inv.lines.map((l) => ({ item: l.item, description: l.description, qty: l.qty, price: l.price, amount: Math.round(l.qty * l.price * 100) / 100 })),
    subtotal: inv.subtotal,
    tax: inv.tax,
    total: inv.total,
  };
}

export const masterData = (): Pick<MatchInput, "vendors" | "purchaseOrders" | "receipts" | "paidBills"> => ({ vendors, purchaseOrders, receipts, paidBills });
