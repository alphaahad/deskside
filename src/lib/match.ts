// 3-way match: invoice (as extracted) vs purchase order vs goods receipt, plus duplicate detection.
// Pure and deterministic. Every check carries citations to the exact document lines it used,
// so explanations in chat are grounded in this output, never in model text.
import type { Check, Citation, Extraction, MatchResult, PaidBill, PurchaseOrder, Receipt, UserRule, Vendor } from "./types";
import { effectiveTolerance } from "./policy";
import { inr } from "./format";

export type MatchInput = {
  invoiceId: string;
  extraction: Extraction;
  vendors: Vendor[];
  purchaseOrders: PurchaseOrder[];
  receipts: Receipt[];
  paidBills: PaidBill[];
  /** Invoices already posted/approved in this workspace (also count as "already paid" for duplicates). */
  settled: { invoiceId: string; vendorId: string; number: string; total: number }[];
  rules: UserRule[];
};

/** "KPC/0042", "KPC-42" and "kpc 42" are the same invoice number. */
export function normaliseNumber(n: string) {
  return (n.toUpperCase().match(/[A-Z]+|\d+/g) ?? []).map((p) => (/^\d+$/.test(p) ? String(Number(p)) : p)).join("");
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function match(input: MatchInput): MatchResult {
  const { extraction: x, invoiceId } = input;
  const checks: Check[] = [];
  const invCite = (line: number, label: string): Citation => ({ doc: "invoice", ref: invoiceId, line, label: `${invoiceId} · line ${line} · ${label}` });

  // 1. Vendor, on tax id (names vary between documents; GSTINs don't).
  const vendor = input.vendors.find((v) => v.gstin === x.vendor_gstin.trim().toUpperCase());
  checks.push(
    vendor
      ? { kind: "vendor", status: "pass", summary: `Vendor ${vendor.name} matched on GSTIN ${vendor.gstin}.`, citations: [{ doc: "invoice", ref: invoiceId, label: `${invoiceId} · GSTIN ${x.vendor_gstin}` }] }
      : { kind: "vendor", status: "fail", summary: `GSTIN ${x.vendor_gstin} is not in the vendor master.`, citations: [{ doc: "invoice", ref: invoiceId, label: `${invoiceId} · GSTIN ${x.vendor_gstin}` }] },
  );

  // 2. Duplicate: same vendor, same normalised number, same total, already paid.
  if (vendor) {
    const key = normaliseNumber(x.invoice_number);
    const paid = input.paidBills.find((b) => b.vendorId === vendor.id && normaliseNumber(b.number) === key && Math.abs(b.total - x.total) < 1);
    const settled = input.settled.find((s) => s.invoiceId !== invoiceId && s.vendorId === vendor.id && normaliseNumber(s.number) === key && Math.abs(s.total - x.total) < 1);
    if (paid) {
      checks.push({
        kind: "duplicate", status: "fail",
        summary: `Duplicate: "${x.invoice_number}" is the same invoice as "${paid.number}" (${paid.billId}), already paid on ${paid.paidOn} for the same ${inr(paid.total)}.`,
        citations: [
          { doc: "invoice", ref: invoiceId, label: `${invoiceId} · No. ${x.invoice_number} · ${inr(x.total)}` },
          { doc: "paid_bill", ref: paid.billId, label: `${paid.billId} · No. ${paid.number} · paid ${paid.paidOn}` },
        ],
      });
    } else if (settled) {
      checks.push({
        kind: "duplicate", status: "fail",
        summary: `Duplicate: "${x.invoice_number}" matches ${settled.invoiceId}, which was already posted for the same amount.`,
        citations: [{ doc: "invoice", ref: settled.invoiceId, label: `${settled.invoiceId} · No. ${settled.number}` }],
      });
    } else {
      checks.push({ kind: "duplicate", status: "pass", summary: `Not a duplicate: no paid bill from this vendor has number ${x.invoice_number}.`, citations: [] });
    }
  }

  // 3. Purchase order.
  const po = input.purchaseOrders.find((p) => p.id === x.po_number.trim().toUpperCase());
  if (!po || (vendor && po.vendorId !== vendor.id)) {
    checks.push({ kind: "po", status: "fail", summary: po ? `${po.id} belongs to a different vendor.` : `PO "${x.po_number}" does not exist.`, citations: [{ doc: "invoice", ref: invoiceId, label: `${invoiceId} · PO ref ${x.po_number}` }] });
    return { ok: false, checks };
  }
  checks.push({ kind: "po", status: "pass", summary: `References ${po.id}, an open PO for this vendor.`, citations: [{ doc: "po", ref: po.id, label: `${po.id} · ${po.lines.length} line${po.lines.length > 1 ? "s" : ""}` }] });

  // 4. Goods receipt.
  const grn = input.receipts.find((r) => r.poId === po.id);
  if (!grn) {
    checks.push({
      kind: "receipt", status: "fail",
      summary: `No goods receipt exists for ${po.id}: nothing on this invoice has been recorded as delivered.`,
      citations: [{ doc: "po", ref: po.id, label: `${po.id} · no GRN recorded` }, invCite(1, `${x.lines[0]?.qty ?? 0} billed`)],
    });
  } else {
    checks.push({ kind: "receipt", status: "pass", summary: `Goods receipt ${grn.id} found for ${po.id}.`, citations: [{ doc: "receipt", ref: grn.id, label: `${grn.id} · received ${grn.date}` }] });
  }

  // 5. Price, per line, against the PO.
  const priceTol = effectiveTolerance("price", input.rules);
  x.lines.forEach((l, i) => {
    const pi = po.lines.findIndex((p) => p.item === l.item);
    if (pi < 0) {
      checks.push({ kind: "price", status: "fail", summary: `Line ${i + 1} (${l.item}) is not on ${po.id}.`, citations: [invCite(i + 1, l.item)] });
      return;
    }
    const p = po.lines[pi];
    const diff = r1(((l.price - p.price) / p.price) * 100);
    const cites: Citation[] = [invCite(i + 1, `${inr(l.price)} × ${l.qty}`), { doc: "po", ref: po.id, line: pi + 1, label: `${po.id} · line ${pi + 1} · ${inr(p.price)} × ${p.qty}` }];
    if (diff > priceTol.pct) {
      checks.push({ kind: "price", status: "fail", summary: `Line ${i + 1}: unit price ${inr(l.price)} vs ${inr(p.price)} on ${po.id}, +${diff}%, over the ${priceTol.pct}% limit.`, citations: cites, rule: priceTol.rule });
    } else if (diff > 0) {
      checks.push({ kind: "price", status: "warn", summary: `Line ${i + 1}: unit price ${inr(l.price)} vs ${inr(p.price)}, +${diff}%, within the ${priceTol.pct}% limit.`, citations: cites, rule: priceTol.rule });
    } else {
      checks.push({ kind: "price", status: "pass", summary: `Line ${i + 1}: unit price matches ${po.id}.`, citations: cites });
    }
  });

  // 6. Quantity billed vs received.
  if (grn) {
    const qtyTol = effectiveTolerance("quantity", input.rules);
    x.lines.forEach((l, i) => {
      const gi = grn.lines.findIndex((g) => g.item === l.item);
      const received = gi >= 0 ? grn.lines[gi].received : 0;
      const over = received === 0 ? 100 : r1(((l.qty - received) / received) * 100);
      const cites: Citation[] = [invCite(i + 1, `${l.qty} billed`), { doc: "receipt", ref: grn.id, line: gi + 1, label: `${grn.id} · line ${gi + 1} · ${received} received` }];
      if (over > qtyTol.pct) {
        checks.push({ kind: "quantity", status: "fail", summary: `Line ${i + 1}: billed ${l.qty}, received ${received} (${l.qty - received} not received, +${over}%), over the ${qtyTol.pct}% limit.`, citations: cites, rule: qtyTol.rule });
      } else if (over > 0) {
        checks.push({ kind: "quantity", status: "warn", summary: `Line ${i + 1}: billed ${l.qty}, received ${received} (+${over}%), within the ${qtyTol.pct}% limit.`, citations: cites, rule: qtyTol.rule });
      } else {
        checks.push({ kind: "quantity", status: "pass", summary: `Line ${i + 1}: billed quantity matches ${grn.id}.`, citations: cites });
      }
    });
  }

  // 7. Arithmetic on the invoice itself.
  const sum = x.lines.reduce((s, l) => s + l.qty * l.price, 0);
  const arithOk = Math.abs(sum - x.subtotal) < 1 && Math.abs(x.subtotal + x.tax - x.total) < 1;
  checks.push({
    kind: "arithmetic", status: arithOk ? "pass" : "fail",
    summary: arithOk ? `Lines add up to ${inr(x.total)} including GST.` : `Totals don't add up: lines ${inr(sum)}, subtotal ${inr(x.subtotal)}, total ${inr(x.total)}.`,
    citations: [{ doc: "invoice", ref: invoiceId, label: `${invoiceId} · total ${inr(x.total)}` }],
  });

  return { ok: checks.every((c) => c.status !== "fail"), checks };
}

/** The checks that put an invoice on hold. */
export const failures = (m: MatchResult) => m.checks.filter((c) => c.status === "fail");

const LABEL: Record<string, string> = {
  vendor: "Unknown vendor", duplicate: "Duplicate invoice", po: "PO problem", receipt: "Missing goods receipt",
  price: "Price mismatch", quantity: "Quantity variance", arithmetic: "Totals don't add up",
};
export const holdLabel = (m: MatchResult) => failures(m).map((c) => LABEL[c.kind]).filter((v, i, a) => a.indexOf(v) === i).join(" + ");
