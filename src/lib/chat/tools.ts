// The agent's tools. Shared by chat (Gemini or offline) and the MCP endpoint.
// Executors are deterministic: they authorize, act, log, and return both a compact result for the
// model and a Card for the UI. Citations in cards come from match output, never from model text.
import "server-only";
import type { Person, Source } from "../types";
import type { Workspace } from "../workspace";
import type { Card, ToolCall, ToolName } from "./types";
import { createRule, decide, explain, heldList, metrics, setFocus, undo } from "../service";
import { resolveInvoiceRef } from "../refs";
import { validateRule } from "../policy";
import { inr0, duration } from "../format";

export type ToolCtx = { ws: Workspace; person: Person; source: Source };
export type ToolOutput = { result: Record<string, unknown>; card?: Card; focus?: string | null };

/** Function declarations in the shape Gemini (and MCP, via `inputSchema`) expects. */
export const TOOL_DECLARATIONS: { name: ToolName; description: string; parameters: Record<string, unknown> }[] = [
  { name: "list_held", description: "List invoices currently on hold, waiting for a human decision.", parameters: { type: "object", properties: {} } },
  {
    name: "explain_invoice",
    description: "Explain why an invoice is on hold (or why it passed), with the cited PO, receipt and invoice lines. Use for any question about a specific invoice.",
    parameters: { type: "object", properties: { invoice: { type: "string", description: "Invoice id like INV-4471, or 4471, or the vendor's invoice number. Omit to use the invoice under discussion." } } },
  },
  {
    name: "approve_invoice",
    description: "Approve a held invoice and post it, overriding the hold. Only when the user explicitly asks to approve. Subject to the user's approval limit.",
    parameters: { type: "object", properties: { invoice: { type: "string", description: "Omit to use the invoice under discussion." }, note: { type: "string" } } },
  },
  {
    name: "reject_invoice",
    description: "Reject a held invoice (a vendor query is drafted, not sent). Only when the user explicitly asks to reject. Subject to the user's approval limit.",
    parameters: { type: "object", properties: { invoice: { type: "string", description: "Omit to use the invoice under discussion." }, note: { type: "string", description: "The user's reason, if given." } } },
  },
  { name: "undo_last", description: "Undo the user's most recent approve, reject or rule change.", parameters: { type: "object", properties: {} } },
  {
    name: "create_hold_rule",
    description: "Remember a standing rule that makes the agent hold more invoices, e.g. 'always hold quantity variance over 5%'. Applies to invoices read from now on. Finance lead only.",
    parameters: {
      type: "object",
      properties: { kind: { type: "string", enum: ["quantity", "price"] }, threshold_pct: { type: "number", description: "Percent, 0-50" } },
      required: ["kind", "threshold_pct"],
    },
  },
  { name: "get_metrics", description: "Time from hold to human decision (median) and the reversal-rate guardrail, vs the mock baseline.", parameters: { type: "object", properties: {} } },
];

export async function runTool(ctx: ToolCtx, call: ToolCall): Promise<ToolOutput> {
  const { ws, person, source } = ctx;
  const target = () => {
    const raw = call.args.invoice as string | undefined;
    if (raw) return { id: resolveInvoiceRef(raw), raw };
    return { id: ws.focus_invoice, raw: null };
  };

  switch (call.name) {
    case "list_held": {
      const items = await heldList(ws.id);
      return {
        result: { count: items.length, items: items.map((i) => ({ invoice: i.invoiceId, vendor: i.vendor, total: inr0(i.total), reason: i.label, escalated_to: i.escalatedTo })) },
        card: { type: "held", items },
      };
    }
    case "explain_invoice": {
      const t = target();
      if (!t.id) return { result: { error: t.raw ? `No invoice matches "${t.raw}".` : "No invoice is under discussion; ask which one." } };
      const ex = await explain(ws.id, t.id);
      if (!ex) return { result: { error: `${t.id} isn't in this inbox yet.` } };
      await setFocus(ws.id, t.id);
      return {
        focus: t.id,
        result: {
          invoice: ex.invoiceId, vendor: ex.vendor, vendor_invoice_number: ex.number, total: inr0(ex.total), status: ex.status, hold_reason: ex.label,
          findings: ex.reasons.map((r) => ({ status: r.status, finding: r.summary, rule: r.rule ?? null, cited: r.citations.map((c) => c.label) })),
          escalated_to: ex.escalatedTo, decided_by: ex.decidedBy,
          note: "The UI shows the citations as chips under your reply; don't list them again.",
        },
        card: { type: "explain", ex },
      };
    }
    case "approve_invoice":
    case "reject_invoice": {
      const t = target();
      if (!t.id) return { result: { error: t.raw ? `No invoice matches "${t.raw}".` : "Which invoice? Nothing is under discussion yet." } };
      const decision = call.name === "approve_invoice" ? "approve" : "reject";
      const out = await decide(ws.id, person, t.id, decision, source, (call.args.note as string | undefined) || undefined);
      await setFocus(ws.id, t.id);
      if (out.ok) return { focus: t.id, result: { done: true, summary: out.summary, undo_available: true }, card: { type: "action", eventId: out.eventId, summary: out.summary, invoiceId: t.id, undoable: true } };
      if (out.kind === "refused") return { focus: t.id, result: { refused: true, reason: out.reason, escalated_to: out.escalatedTo ?? null }, card: { type: "refusal", reason: out.reason, escalatedTo: out.escalatedTo } };
      return { focus: t.id, result: { error: out.reason } };
    }
    case "undo_last": {
      const out = await undo(ws.id, person, source);
      if (out.ok) return { result: { done: true, summary: out.summary }, card: { type: "action", eventId: out.eventId, summary: out.summary, invoiceId: out.invoiceId, undoable: false } };
      if (out.kind === "refused") return { result: { refused: true, reason: out.reason }, card: { type: "refusal", reason: out.reason } };
      return { result: { error: out.reason } };
    }
    case "create_hold_rule": {
      const r = validateRule({ kind: String(call.args.kind), thresholdPct: Number(call.args.threshold_pct) });
      if (!r) return { result: { error: "I can only remember price or quantity variance rules between 0% and 50%." } };
      const out = await createRule(ws, person, r.kind, r.thresholdPct, source);
      if (out.ok) return { result: { done: true, summary: out.summary }, card: { type: "action", eventId: out.eventId, summary: out.summary, undoable: true } };
      return { result: { refused: true, reason: out.reason }, card: { type: "refusal", reason: out.reason, escalatedTo: out.kind === "refused" ? out.escalatedTo : undefined } };
    }
    case "get_metrics": {
      const m = await metrics(ws.id);
      return {
        result: {
          median_hold_to_decision: m.medianMs == null ? "no decisions yet" : duration(m.medianMs),
          decided: m.decided, still_held: m.stillHeld,
          mock_baseline_median: m.baselineMedianMs == null ? null : duration(m.baselineMedianMs),
          chat_reversals: `${m.reversal.chat.reversed}/${m.reversal.chat.total}`, button_reversals: `${m.reversal.button.reversed}/${m.reversal.button.total}`,
          guardrail: m.guardrail,
        },
        card: { type: "metrics", m },
      };
    }
  }
}
