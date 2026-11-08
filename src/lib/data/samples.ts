// MOCK sample invoices for the Deployment readiness tab: a customer's "send us a few real invoices"
// stand-in. Matched against the same mock master data as the inbox.
import type { SeedInvoice } from "../types";

const mk = (id: string, vendorId: string, number: string, poId: string, lines: SeedInvoice["lines"], scenario: string): SeedInvoice => {
  const subtotal = Math.round(lines.reduce((s, l) => s + l.qty * l.price, 0) * 100) / 100;
  const tax = Math.round(subtotal * 0.18 * 100) / 100;
  return { id, vendorId, number, date: "2026-11-07", poId, lines, subtotal, tax, total: Math.round((subtotal + tax) * 100) / 100, wave: 1, scenario };
};

export const samples: SeedInvoice[] = [
  mk("SMP-01", "V4", "BLE/1102", "PO-2268", [{ item: "BL-MCB", description: "MCB 32A", qty: 80, price: 315 }], "clean"),
  mk("SMP-02", "V5", "CCL-24-5601", "PO-2275", [{ item: "CC-DGR", description: "Degreaser 5L", qty: 40, price: 780 }], "clean"),
  mk("SMP-03", "V3", "SOS/26-27/1290", "PO-2272", [{ item: "SO-A4", description: "A4 paper ream", qty: 40, price: 276 }], "price +4.2%"),
  mk("SMP-04", "V2", "KPC-0455", "PO-2399", [{ item: "KP-BX5", description: "5-ply carton 18x12x12", qty: 500, price: 38 }], "PO doesn't exist"),
  mk("SMP-05", "V1", "HSS-INV-3460", "PO-2276", [{ item: "HS-AN40", description: "Angle 40x40x5", qty: 25, price: 640 }, { item: "HS-BLT12", description: "Hex bolt M12 (box)", qty: 20, price: 420 }], "clean"),
  mk("SMP-06", "V5", "CCL-24-5606", "PO-2264", [{ item: "CC-DGR", description: "Degreaser 5L", qty: 32, price: 780 }], "qty +6.7%, within 10%"),
];
