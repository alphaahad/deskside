// North star: median time from the agent holding an item to a human decision.
// Guardrail: reversal rate on decisions made via chat must not exceed the button / baseline rate.
// Pure and unit-tested.
import type { Source } from "./types";

export type Decision = { invoiceId: string; heldAt: string; decidedAt: string; source: Source; reversed: boolean };

export const MIN_SAMPLE = 20;

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export type Rate = { reversed: number; total: number; rate: number | null };
const rate = (ds: { reversed: boolean }[]): Rate => ({
  reversed: ds.filter((d) => d.reversed).length,
  total: ds.length,
  rate: ds.length ? ds.filter((d) => d.reversed).length / ds.length : null,
});

export type Guardrail = { state: "ok" | "breached" | "insufficient"; note: string };

export function summarise(decisions: Decision[], baseline: { heldAt: string; decidedAt: string; reversed: boolean }[], stillHeld: number) {
  // A reversed decision is not a decision: its wait doesn't count as "decided" in the north star.
  const final = decisions.filter((d) => !d.reversed);
  const waits = final.map((d) => Date.parse(d.decidedAt) - Date.parse(d.heldAt));
  const baseWaits = baseline.map((b) => Date.parse(b.decidedAt) - Date.parse(b.heldAt));

  const chat = rate(decisions.filter((d) => d.source === "chat" || d.source === "mcp"));
  const button = rate(decisions.filter((d) => d.source === "button"));
  const base = rate(baseline);

  // Compare chat against the better of the two references we have, but only once there's enough data.
  const reference = button.total >= MIN_SAMPLE ? button : base;
  let guardrail: Guardrail;
  if (chat.total < MIN_SAMPLE) {
    guardrail = { state: "insufficient", note: `Need ${MIN_SAMPLE}+ chat decisions to judge (have ${chat.total}).` };
  } else if ((chat.rate ?? 0) > (reference.rate ?? 0)) {
    guardrail = { state: "breached", note: `Chat reversals ${(100 * (chat.rate ?? 0)).toFixed(0)}% exceed ${(100 * (reference.rate ?? 0)).toFixed(0)}%.` };
  } else {
    guardrail = { state: "ok", note: `Chat reversals at or below ${(100 * (reference.rate ?? 0)).toFixed(0)}%.` };
  }

  return {
    medianMs: median(waits),
    decided: final.length,
    stillHeld,
    baselineMedianMs: median(baseWaits),
    baselineCount: baseline.length,
    reversal: { chat, button, baseline: base },
    guardrail,
  };
}

export type MetricsSummary = ReturnType<typeof summarise>;
