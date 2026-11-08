// Tolerances and the rules a user teaches the agent. Pure, unit-tested.
import type { UserRule } from "./types";

/** Defaults. ASSUMPTION: typical starting tolerances; real customers set these per vendor or category. */
export const DEFAULTS = {
  pricePct: 2, // unit price may exceed the PO by up to 2%
  quantityPct: 10, // billed quantity may exceed the received quantity by up to 10%
};

export type Effective = { pct: number; rule: string; ruleId?: string };

/** The tightest active threshold wins: a user rule can only make the agent stricter, never looser. */
export function effectiveTolerance(kind: "price" | "quantity", rules: UserRule[]): Effective {
  const base: Effective = {
    pct: kind === "price" ? DEFAULTS.pricePct : DEFAULTS.quantityPct,
    rule: `${kind === "price" ? "Price" : "Quantity"} tolerance ${kind === "price" ? DEFAULTS.pricePct : DEFAULTS.quantityPct}% (default policy)`,
  };
  return rules
    .filter((r) => r.active && r.kind === kind && r.thresholdPct < base.pct)
    .reduce<Effective>((best, r) => (r.thresholdPct < best.pct ? { pct: r.thresholdPct, rule: describeRule(r), ruleId: r.id } : best), base);
}

export function describeRule(r: Pick<UserRule, "id" | "kind" | "thresholdPct" | "createdBy" | "source">) {
  const via = r.source === "chat" ? "in chat" : r.source === "mcp" ? "via Claude (MCP)" : "with a button";
  return `${r.id}: hold ${r.kind === "price" ? "price" : "quantity"} variance over ${r.thresholdPct}% (set by ${r.createdBy} ${via})`;
}

export type ParsedRule = { kind: "quantity" | "price"; thresholdPct: number };

/**
 * Deterministic reading of "always hold quantity variance over 5%".
 * Used by the offline router and to double-check what the model proposes.
 */
export function parseRule(text: string): ParsedRule | null {
  const t = text.toLowerCase();
  if (!/\b(hold|flag|stop|block)\b/.test(t)) return null;
  const pct = t.match(/(\d+(?:\.\d+)?)\s*(%|percent|per cent)/);
  if (!pct) return null;
  const thresholdPct = Number(pct[1]);
  const kind = /\b(qty|quantit(y|ies)|units?)\b/.test(t) ? "quantity" : /\b(price|rate|unit cost)\b/.test(t) ? "price" : null;
  if (!kind) return null;
  return validateRule({ kind, thresholdPct });
}

/** Rules are bounded: anything outside 0–50% is a typo or a bad idea, and the agent says so. */
export function validateRule(r: { kind: string; thresholdPct: number }): ParsedRule | null {
  if (r.kind !== "quantity" && r.kind !== "price") return null;
  if (!Number.isFinite(r.thresholdPct) || r.thresholdPct < 0 || r.thresholdPct > 50) return null;
  return { kind: r.kind, thresholdPct: r.thresholdPct };
}
