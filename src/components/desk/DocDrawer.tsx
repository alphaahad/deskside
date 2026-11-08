"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Citation, Extraction, MatchResult, PaidBill, PurchaseOrder, Receipt, Vendor } from "@/lib/types";
import { inr } from "@/lib/format";

type Doc = {
  invoiceId: string;
  pdf: string;
  vendor: Vendor;
  extraction: Extraction | null;
  read: { source: string | null; ms: number | null };
  match: MatchResult | null;
  po: PurchaseOrder | null;
  receipt: Receipt | null;
  paidBill: PaidBill | null;
};

/** Side sheet: the invoice PDF next to the PO and goods receipt it was matched against, cited lines highlighted. */
export function DocDrawer({ target, onClose }: { target: { invoiceId: string; cite?: Citation } | null; onClose: () => void }) {
  const [doc, setDoc] = useState<Doc | null>(null);
  const id = target?.invoiceId;

  useEffect(() => {
    if (!id) return;
    let alive = true;
    fetch(`/api/doc/${id}`, { cache: "no-store" }).then((r) => r.json()).then((d) => alive && setDoc(d));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => { alive = false; window.removeEventListener("keydown", onKey); };
  }, [id, onClose]);

  if (!target) return null;
  const ready = doc && doc.invoiceId === target.invoiceId ? doc : null;

  // Every line any failing or warning check cited, plus the one the user clicked.
  const cited = new Set<string>();
  ready?.match?.checks.filter((c) => c.status !== "pass").forEach((c) => c.citations.forEach((x) => cited.add(`${x.ref}#${x.line ?? 0}`)));
  if (target.cite) cited.add(`${target.cite.ref}#${target.cite.line ?? 0}`);
  const hl = (ref: string, line: number) => cited.has(`${ref}#${line}`);
  const focus = (ref: string) => target.cite?.ref === ref;

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label={`Documents for ${target.invoiceId}`}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/20" />
      <div className="animate-enter relative flex h-full w-[min(1100px,96vw)] flex-col bg-canvas shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line bg-surface px-5 py-3">
          <div>
            <p className="text-sm font-semibold">{target.invoiceId}{ready ? ` · ${ready.vendor.name}` : ""}</p>
            <p className="text-xs text-muted">Invoice as received, and the PO and receipt Meera matched it against. Highlighted: the cited lines. Mock data.</p>
          </div>
          <button type="button" onClick={onClose} className="pressable ml-auto rounded-md p-1.5 text-muted hover:bg-canvas hover:text-ink" aria-label="Close documents">
            <X className="size-5" />
          </button>
        </div>
        {!ready ? (
          <p className="p-6 text-sm text-muted">Loading…</p>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-[1fr_440px]">
            <div className="relative h-full border-r border-line bg-white">
              <iframe src={`${ready.pdf}#view=FitH&toolbar=0`} title={`${ready.invoiceId} PDF`} className="h-full w-full" />
              <a href={ready.pdf} target="_blank" rel="noreferrer" className="absolute bottom-3 left-3 rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink-2 shadow-sm hover:text-ink">
                Open the PDF in a new tab
              </a>
            </div>
            <div className="scroll-quiet min-h-0 space-y-4 overflow-y-auto p-4">
              {ready.extraction && (
                <Block title={`Invoice ${ready.extraction.invoice_number}`} sub={`What Meera read · Gemini (${ready.read.source}${ready.read.ms ? `, ${(ready.read.ms / 1000).toFixed(1)}s` : ""})`} focus={focus(ready.invoiceId)}>
                  <Table head={["#", "Item", "Qty", "Unit price"]} rows={ready.extraction.lines.map((l, i) => ({ hl: hl(ready.invoiceId, i + 1), cells: [i + 1, l.item, l.qty, inr(l.price)] }))} />
                  <p className="mt-1.5 text-right text-xs text-muted">Total {inr(ready.extraction.total)} · PO ref {ready.extraction.po_number}</p>
                </Block>
              )}
              {ready.po && (
                <Block title={ready.po.id} sub={`Purchase order · ${ready.po.date}`} focus={focus(ready.po.id)}>
                  <Table head={["#", "Item", "Ordered", "Unit price"]} rows={ready.po.lines.map((l, i) => ({ hl: hl(ready.po!.id, i + 1), cells: [i + 1, l.item, l.qty, inr(l.price)] }))} />
                </Block>
              )}
              {ready.receipt ? (
                <Block title={ready.receipt.id} sub={`Goods receipt · ${ready.receipt.date}`} focus={focus(ready.receipt.id)}>
                  <Table head={["#", "Item", "Received"]} rows={ready.receipt.lines.map((l, i) => ({ hl: hl(ready.receipt!.id, i + 1), cells: [i + 1, l.item, l.received] }))} />
                </Block>
              ) : (
                <Block title="Goods receipt" sub="None recorded for this PO" focus={false}>
                  <p className="rounded-md bg-bad-soft px-3 py-2 text-sm text-bad">No goods receipt exists for {ready.po?.id ?? "this PO"}.</p>
                </Block>
              )}
              {ready.paidBill && (
                <Block title={ready.paidBill.billId} sub={`Already paid on ${ready.paidBill.paidOn}`} focus={focus(ready.paidBill.billId)}>
                  <p className="rounded-md bg-bad-soft px-3 py-2 text-sm">Vendor invoice no. <b>{ready.paidBill.number}</b> · {inr(ready.paidBill.total)}</p>
                </Block>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Block({ title, sub, focus, children }: { title: string; sub: string; focus: boolean; children: React.ReactNode }) {
  return (
    <section className={`rounded-lg border bg-surface p-3 ${focus ? "border-accent ring-2 ring-accent/15" : "border-line"}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mb-2 text-xs text-muted">{sub}</p>
      {children}
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: { hl: boolean; cells: (string | number)[] }[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-muted">{head.map((h) => <th key={h} className="pb-1 font-medium">{h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className={r.hl ? "bg-warn-soft font-medium" : ""} data-highlight={r.hl || undefined}>
            {r.cells.map((c, j) => <td key={j} className={`py-1 tabular-nums ${j === 0 ? "pl-1 w-6" : ""}`}>{c}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
