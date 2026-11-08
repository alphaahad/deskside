import { describe, expect, it } from "vitest";
import { match, normaliseNumber, failures, holdLabel } from "./match";
import { invoices } from "./data/seed";
import { truthExtraction, masterData } from "./data/truth";
import { parseRule, effectiveTolerance } from "./policy";
import type { UserRule } from "./types";

const run = (id: string, rules: UserRule[] = []) => {
  const inv = invoices.find((i) => i.id === id)!;
  return match({ invoiceId: id, extraction: truthExtraction(inv), ...masterData(), settled: [], rules });
};
const R1: UserRule = { id: "R-1", kind: "quantity", thresholdPct: 5, createdBy: "Arjun", source: "chat", createdAt: "2026-11-08T10:00:00Z", active: true };

describe("3-way match on the mock inbox", () => {
  it("holds exactly the four planted exceptions in wave 1", () => {
    const held = invoices.filter((i) => i.wave === 1 && !run(i.id).ok).map((i) => i.id);
    expect(held).toEqual(["INV-4466", "INV-4471", "INV-4474", "INV-4477"]);
  });

  it("price mismatch cites the invoice line and the PO line", () => {
    const [f] = failures(run("INV-4471"));
    expect(f.kind).toBe("price");
    expect(f.summary).toContain("₹1,060.00");
    expect(f.summary).toContain("+6%");
    expect(f.citations.map((c) => c.ref)).toEqual(["INV-4471", "PO-2271"]);
  });

  it("missing receipt, duplicate and quantity variance are labelled", () => {
    expect(holdLabel(run("INV-4466"))).toBe("Missing goods receipt");
    expect(holdLabel(run("INV-4474"))).toBe("Duplicate invoice");
    const q = failures(run("INV-4477"))[0];
    expect(q.kind).toBe("quantity");
    expect(q.citations.map((c) => c.ref)).toEqual(["INV-4477", "GRN-5577"]);
  });

  it("a 1.2% price difference passes with a warning", () => {
    const m = run("INV-4463");
    expect(m.ok).toBe(true);
    expect(m.checks.find((c) => c.kind === "price")?.status).toBe("warn");
  });

  it("a 7% quantity variance passes by default but is held under a 5% rule, citing the rule", () => {
    expect(run("INV-4481").ok).toBe(true);
    const m = run("INV-4481", [R1]);
    expect(m.ok).toBe(false);
    expect(failures(m)[0].rule).toContain("R-1");
  });

  it("wave 2 is otherwise clean", () => {
    expect(run("INV-4480").ok).toBe(true);
    expect(run("INV-4482", [R1]).ok).toBe(true);
  });
});

describe("helpers", () => {
  it("normalises invoice numbers", () => {
    expect(normaliseNumber("KPC/0042")).toBe(normaliseNumber("KPC-42"));
    expect(normaliseNumber("KPC-0391")).not.toBe(normaliseNumber("KPC-42"));
  });

  it("parses rules from plain English", () => {
    expect(parseRule("Always hold quantity variance over 5%")).toEqual({ kind: "quantity", thresholdPct: 5 });
    expect(parseRule("hold anything where the price is more than 1.5 percent above PO")).toEqual({ kind: "price", thresholdPct: 1.5 });
    expect(parseRule("what's on hold?")).toBeNull();
    expect(parseRule("hold quantity variance over 80%")).toBeNull();
  });

  it("rules only ever tighten tolerance", () => {
    expect(effectiveTolerance("quantity", [{ ...R1, thresholdPct: 20 }]).pct).toBe(10);
    expect(effectiveTolerance("quantity", [R1]).pct).toBe(5);
    expect(effectiveTolerance("quantity", [{ ...R1, active: false }]).pct).toBe(10);
  });
});
