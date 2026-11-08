// Deterministic intent reading. Two jobs:
//  1. Offline mode: route a message to tool calls when Gemini is unavailable (no key, quota, outage).
//  2. Write guard: the model may only take a write action the user's own words actually asked for.
// Pure and unit-tested.
import type { ToolCall } from "./types";
import { parseRule } from "../policy";
import { resolveInvoiceRef } from "../refs";

const UNDO = /\b(undo|revert|reverse|take (it|that) back|roll ?back)\b/i;
const REJECT = /\b(reject|decline|send (it |this )?back|refuse|don'?t pay|do not pay)\b/i;
const APPROVE = /\b(approve|approved|release|go ahead|ok(ay)? (to )?(pay|post)|post (it|this|that|inv)|pay (it|this|that))\b/i;
const BULK = /\b(all|everything|every one|them|these|those)\b/i;
const EXPLAIN = /\b(why|explain|what'?s wrong|what is wrong|reason|details?|tell me (about|more)|show me|look at|what happened)\b/i;
const LIST = /\b(on hold|held|stuck|waiting|pending|queue|exceptions?|needs? (me|my|attention|you)|anything for me|what'?s up)\b/i;
const METRICS = /\b(metrics?|how (are|am) (we|i) doing|time to decision|reversal|north star|guardrail|median)\b/i;

export const asksToApprove = (t: string) => APPROVE.test(t) && !REJECT.test(t);
export const asksToReject = (t: string) => REJECT.test(t);
export const asksToUndo = (t: string) => UNDO.test(t);
export const asksForRule = (t: string) => parseRule(t) !== null || /\b(always|from now on|going forward|rule)\b/i.test(t);

export type Routed = { calls: ToolCall[] } | { reply: string };

export function route(text: string): Routed {
  const t = text.trim();
  const ref = resolveInvoiceRef(t);
  const invoice = ref ?? undefined;
  const note = t.match(/\b(?:because|note:?|reason:?)\s+(.+)$/i)?.[1];

  if (UNDO.test(t)) return { calls: [{ name: "undo_last", args: {} }] };

  const rule = parseRule(t);
  if (rule) return { calls: [{ name: "create_hold_rule", args: { kind: rule.kind, threshold_pct: rule.thresholdPct } }] };
  if (/\b(always|from now on|going forward)\b/i.test(t)) {
    return { reply: "I can remember hold rules for price or quantity variance, for example \"always hold quantity variance over 5%\". Which one should I set?" };
  }

  if (REJECT.test(t) || APPROVE.test(t)) {
    if (!ref && BULK.test(t)) {
      return { reply: "I decide one invoice at a time, so every decision has a named owner and its own undo. Which one first?" };
    }
    const name = REJECT.test(t) ? "reject_invoice" : "approve_invoice";
    return { calls: [{ name, args: { invoice, note } }] };
  }

  if (METRICS.test(t)) return { calls: [{ name: "get_metrics", args: {} }] };
  if (ref || EXPLAIN.test(t)) {
    if (!ref && LIST.test(t)) return { calls: [{ name: "list_held", args: {} }] };
    return { calls: [{ name: "explain_invoice", args: { invoice } }] };
  }
  if (LIST.test(t)) return { calls: [{ name: "list_held", args: {} }] };

  return {
    reply: "I'm in offline mode right now, so I understand a fixed set of requests: \"what's on hold?\", \"why is 4471 on hold?\", \"approve it\", \"reject it\", \"undo\", \"always hold quantity variance over 5%\" and \"how are we doing?\".",
  };
}
