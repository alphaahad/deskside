// Shared shapes. Everything here describes MOCK data generated for the demo.

export type Vendor = {
  id: string;
  name: string;
  gstin: string;
  city: string;
  email: string;
  terms: string;
  layout: "classic" | "modern" | "compact";
};

export type Line = { item: string; description: string; qty: number; price: number };

export type PurchaseOrder = { id: string; vendorId: string; date: string; lines: Line[] };
export type Receipt = { id: string; poId: string; date: string; lines: { item: string; received: number }[] };

/** An invoice as the vendor sent it (the ground truth the PDF is drawn from). */
export type SeedInvoice = {
  id: string; // our inbox id, e.g. INV-4471
  vendorId: string;
  number: string; // vendor's own invoice number, as printed
  date: string;
  poId: string;
  lines: Line[];
  subtotal: number;
  tax: number;
  total: number;
  wave: 1 | 2;
  scenario: string; // for humans reading the seed, never shown as a reason
};

export type PaidBill = { vendorId: string; number: string; total: number; paidOn: string; billId: string };

/** What the agent read off the PDF. */
export type Extraction = {
  vendor_name: string;
  vendor_gstin: string;
  invoice_number: string;
  invoice_date: string;
  po_number: string;
  lines: { item: string; description: string; qty: number; price: number; amount: number }[];
  subtotal: number;
  tax: number;
  total: number;
};

export type LlmSource = "live" | "cached" | "fallback";

/** A pointer to the exact document line a claim rests on. Rendered as a chip; never written by the model. */
export type Citation = {
  doc: "invoice" | "po" | "receipt" | "paid_bill" | "rule" | "policy";
  ref: string; // INV-4471, PO-2271, GRN-5571, R-1 …
  line?: number; // 1-based line on that document
  label: string; // "line 1 · ₹1,060.00 × 50"
};

export type CheckKind = "vendor" | "duplicate" | "po" | "receipt" | "price" | "quantity" | "arithmetic";

export type Check = {
  kind: CheckKind;
  status: "pass" | "warn" | "fail";
  summary: string; // one sentence, plain English
  citations: Citation[];
  rule?: string; // "Price tolerance 2% (default)" or "R-1: hold quantity variance over 5% (set by Arjun in chat)"
};

export type MatchResult = { ok: boolean; checks: Check[] };

export type InvoiceStatus = "queued" | "posted" | "held" | "approved" | "rejected";

export type Role = "clerk" | "lead";
export type Person = { id: string; name: string; role: Role; title: string; limit: number | null };

export type Source = "agent" | "chat" | "button" | "mcp" | "rule";

export type UserRule = {
  id: string; // R-1
  kind: "quantity" | "price";
  thresholdPct: number;
  createdBy: string;
  source: Source;
  createdAt: string;
  active: boolean;
};
