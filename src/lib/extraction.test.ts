// Scores the committed snapshot of real Gemini reads against what each mock PDF actually says,
// and checks the reads lead to the same holds as a perfect read would.
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import snapshot from "./data/gemini-cache.json";
import { invoices } from "./data/seed";
import { samples } from "./data/samples";
import { masterData, truthExtraction } from "./data/truth";
import { match } from "./match";
import type { Extraction, UserRule } from "./types";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
const cached = (dir: string, id: string) => {
  const key = sha(`v1|${MODEL}|extract|${sha(readFileSync(join(process.cwd(), "public", dir, `${id}.pdf`)))}`);
  return (snapshot as { key: string; value: Extraction }[]).find((e) => e.key === key)?.value;
};
const R1: UserRule = { id: "R-1", kind: "quantity", thresholdPct: 5, createdBy: "Arjun", source: "chat", createdAt: "", active: true };

describe("Gemini snapshot", () => {
  it.each(invoices.map((i) => i.id))("%s: read matches the document", (id) => {
    const inv = invoices.find((i) => i.id === id)!;
    const got = cached("invoices", id);
    expect(got, "no cached read for this PDF; run the app with a key, then npm run cache:export").toBeDefined();
    const want = truthExtraction(inv);
    expect(got!.invoice_number).toBe(want.invoice_number);
    expect(got!.vendor_gstin).toBe(want.vendor_gstin);
    expect(got!.po_number).toBe(want.po_number);
    expect(got!.total).toBeCloseTo(want.total, 0);
    expect(got!.lines.map((l) => [l.item, l.qty, l.price])).toEqual(want.lines.map((l) => [l.item, l.qty, l.price]));
  });

  it("real reads produce exactly the planted holds", () => {
    const outcome = (id: string, rules: UserRule[] = []) =>
      match({ invoiceId: id, extraction: cached("invoices", id)!, ...masterData(), settled: [], rules }).ok;
    expect(invoices.filter((i) => i.wave === 1 && !outcome(i.id)).map((i) => i.id)).toEqual(["INV-4466", "INV-4471", "INV-4474", "INV-4477"]);
    expect(outcome("INV-4481")).toBe(true);
    expect(outcome("INV-4481", [R1])).toBe(false);
  });

  it("readiness samples are cached too", () => {
    for (const s of samples) expect(cached("samples", s.id), s.id).toBeDefined();
  });
});
