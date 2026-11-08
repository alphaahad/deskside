"use client";
import { FileText, ShieldAlert, Undo2, CheckCircle2, AlertTriangle, CircleCheck } from "lucide-react";
import type { Card } from "@/lib/chat/types";
import type { Citation } from "@/lib/types";
import type { FeedEvent } from "@/lib/service";
import { inr0 } from "@/lib/format";
import { MetricsBody } from "./MetricCard";

export type OpenDoc = (invoiceId: string, cite?: Citation) => void;

const DOC_LABEL: Record<Citation["doc"], string> = { invoice: "Invoice", po: "PO", receipt: "Receipt", paid_bill: "Paid bill", rule: "Rule", policy: "Policy" };

export function CitationChip({ c, invoiceId, open }: { c: Citation; invoiceId: string; open: OpenDoc }) {
  return (
    <button
      type="button"
      onClick={() => open(invoiceId, c)}
      className="pressable inline-flex max-w-full items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-left text-xs text-ink-2 hover:border-accent/40 hover:text-accent"
      title={`Open ${DOC_LABEL[c.doc]} ${c.ref}`}
    >
      <FileText className="size-3.5 shrink-0 text-muted" aria-hidden />
      <span className="font-medium text-ink">{DOC_LABEL[c.doc]}</span>
      <span className="truncate">{c.label}</span>
    </button>
  );
}

export function Cards({ cards, events, open, onUndo, onAsk }: { cards: Card[]; events: FeedEvent[]; open: OpenDoc; onUndo: (eventId: number) => void; onAsk: (text: string) => void }) {
  return (
    <div className="mt-2 flex flex-col gap-2">
      {cards.map((card, i) => {
        switch (card.type) {
          case "explain": {
            const ex = card.ex;
            const held = ex.status === "held";
            return (
              <div key={i} className="rounded-lg border border-line bg-surface p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <button type="button" onClick={() => open(ex.invoiceId)} className="text-sm font-semibold hover:text-accent">
                    {ex.invoiceId} · {ex.vendor}
                  </button>
                  <span className="text-sm tabular-nums text-ink-2">{inr0(ex.total)}</span>
                </div>
                <div className="mt-0.5 text-xs text-muted">
                  {held ? <span className="font-medium text-bad">On hold: {ex.label}</span> : <span className="capitalize">{ex.status}</span>}
                  {ex.escalatedTo && <span> · flagged for {ex.escalatedTo}</span>}
                  {ex.read.source && <span> · read by Gemini ({ex.read.source})</span>}
                </div>
                {ex.reasons.map((r, j) => (
                  <div key={j} className="mt-2.5">
                    <p className="flex gap-1.5 text-sm text-ink">
                      {r.status === "fail" ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden /> : <CircleCheck className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />}
                      {r.summary}
                    </p>
                    {r.rule && <p className="ml-5.5 mt-0.5 text-xs text-muted">{r.rule}</p>}
                    <div className="ml-5.5 mt-1.5 flex flex-wrap gap-1.5">
                      {r.citations.map((c, k) => <CitationChip key={k} c={c} invoiceId={ex.invoiceId} open={open} />)}
                    </div>
                  </div>
                ))}
                {ex.passed.length > 0 && (
                  <div className="mt-2.5 border-t border-line pt-2">
                    <p className="text-xs text-muted">Also checked and fine: {ex.passed.map((p) => p.kind).filter((v, k, a) => a.indexOf(v) === k).join(", ")}.</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {ex.passed.filter((p) => p.kind === "receipt" || p.kind === "po").flatMap((p) => p.citations).map((c, k) => <CitationChip key={k} c={c} invoiceId={ex.invoiceId} open={open} />)}
                    </div>
                  </div>
                )}
              </div>
            );
          }
          case "held":
            return (
              <div key={i} className="overflow-hidden rounded-lg border border-line bg-surface">
                {card.items.length === 0 && <p className="p-3 text-sm text-muted">Nothing on hold.</p>}
                {card.items.map((h) => (
                  <button key={h.invoiceId} type="button" onClick={() => onAsk(`Why is ${h.invoiceId} on hold?`)}
                    className="flex w-full items-center gap-3 border-b border-line px-3 py-2 text-left text-sm last:border-0 hover:bg-canvas">
                    <span className="w-20 font-medium">{h.invoiceId}</span>
                    <span className="flex-1 truncate text-ink-2">{h.label}</span>
                    <span className="tabular-nums text-ink-2">{inr0(h.total)}</span>
                  </button>
                ))}
              </div>
            );
          case "action": {
            const ev = events.find((e) => e.id === card.eventId);
            const undone = ev?.undone_by != null;
            return (
              <div key={i} className={`flex items-start gap-2.5 rounded-lg border p-3 text-sm ${undone ? "border-line bg-canvas text-muted" : "border-ok/25 bg-ok-soft"}`}>
                <CheckCircle2 className={`mt-0.5 size-4 shrink-0 ${undone ? "text-muted" : "text-ok"}`} aria-hidden />
                <div className="flex-1">
                  <p className={undone ? "line-through decoration-muted/50" : ""}>{card.summary}</p>
                  <p className="mt-0.5 text-xs text-muted">Logged to the activity feed · source: chat{undone ? " · undone" : ""}</p>
                </div>
                {card.undoable && !undone && (
                  <button type="button" onClick={() => onUndo(card.eventId)} className="pressable inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-xs font-medium text-ink-2 hover:text-ink">
                    <Undo2 className="size-3.5" aria-hidden /> Undo
                  </button>
                )}
              </div>
            );
          }
          case "refusal":
            return (
              <div key={i} className="flex items-start gap-2.5 rounded-lg border border-bad/25 bg-bad-soft p-3 text-sm">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
                <div>
                  <p className="font-medium text-bad">Not allowed</p>
                  <p className="mt-0.5 text-ink-2">{card.reason}</p>
                  {card.escalatedTo && <p className="mt-1 text-xs text-muted">Escalated to {card.escalatedTo}. Logged to the activity feed.</p>}
                </div>
              </div>
            );
          case "metrics":
            return (
              <div key={i} className="rounded-lg border border-line bg-surface p-3">
                <MetricsBody m={card.m} />
              </div>
            );
        }
      })}
    </div>
  );
}
