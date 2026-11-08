import { describe, expect, it } from "vitest";
import { median, summarise, type Decision } from "./metrics";
import { baseline } from "./data/baseline";
import { authorize } from "./authz";
import { people } from "./data/seed";

const d = (mins: number, source: Decision["source"], reversed = false): Decision => ({
  invoiceId: "X", heldAt: "2026-11-08T10:00:00Z", decidedAt: new Date(Date.parse("2026-11-08T10:00:00Z") + mins * 60_000).toISOString(), source, reversed,
});

describe("metrics", () => {
  it("median", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });

  it("mock baseline: 40 items, median about two days, 5% reversed", () => {
    const s = summarise([], baseline, 0);
    expect(s.baselineCount).toBe(40);
    const days = s.baselineMedianMs! / 86_400_000;
    expect(days).toBeGreaterThan(1.5);
    expect(days).toBeLessThan(2.6);
    expect(s.reversal.baseline.rate).toBe(0.05);
  });

  it("reversed decisions don't count toward the north star, but do count as reversals", () => {
    const s = summarise([d(2, "chat"), d(4, "chat", true), d(6, "button")], baseline, 1);
    expect(s.decided).toBe(2);
    expect(s.medianMs).toBe(4 * 60_000);
    expect(s.reversal.chat).toEqual({ reversed: 1, total: 2, rate: 0.5 });
  });

  it("guardrail waits for a real sample before judging", () => {
    expect(summarise([d(1, "chat", true)], baseline, 0).guardrail.state).toBe("insufficient");
    const many = Array.from({ length: 20 }, (_, i) => d(i, "chat", i < 3));
    expect(summarise(many, baseline, 0).guardrail.state).toBe("breached"); // 15% > 5%
    const good = Array.from({ length: 20 }, (_, i) => d(i, "chat", i < 1));
    expect(summarise(good, baseline, 0).guardrail.state).toBe("ok"); // 5% <= 5%
  });
});

describe("authorize", () => {
  const [priya, arjun] = people;
  it("clerk can decide under the limit, not over it, and is escalated", () => {
    expect(authorize(priya, { kind: "decide", decision: "approve", invoiceId: "INV-4471", amount: 62_540 }).allowed).toBe(true);
    const v = authorize(priya, { kind: "decide", decision: "approve", invoiceId: "INV-4477", amount: 212_400 });
    expect(v.allowed).toBe(false);
    if (!v.allowed) {
      expect(v.reason).toContain("₹1,00,000");
      expect(v.escalateTo?.name).toBe("Arjun");
    }
  });
  it("clerk can't change rules or undo someone else's decision; lead can do anything", () => {
    expect(authorize(priya, { kind: "rule" }).allowed).toBe(false);
    expect(authorize(priya, { kind: "undo", actorOfOriginal: "Arjun", originalSummary: "x" }).allowed).toBe(false);
    expect(authorize(priya, { kind: "undo", actorOfOriginal: "Priya", originalSummary: "x" }).allowed).toBe(true);
    expect(authorize(arjun, { kind: "decide", decision: "reject", invoiceId: "INV-4477", amount: 9e9 }).allowed).toBe(true);
  });
});
