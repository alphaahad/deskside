import { describe, expect, it } from "vitest";
import { route, asksToApprove, asksToReject } from "./intent";
import { resolveInvoiceRef } from "../refs";

const calls = (t: string) => {
  const r = route(t);
  return "calls" in r ? r.calls : r.reply;
};

describe("offline router: the demo script", () => {
  it("routes each scripted line", () => {
    expect(calls("What's on hold?")).toEqual([{ name: "list_held", args: {} }]);
    expect(calls("Why is invoice 4471 on hold?")).toEqual([{ name: "explain_invoice", args: { invoice: "INV-4471", note: undefined } }].map((c) => ({ ...c, args: { invoice: "INV-4471" } })));
    expect(calls("approve it")).toEqual([{ name: "approve_invoice", args: { invoice: undefined, note: undefined } }]);
    expect(calls("Approve 4477")).toEqual([{ name: "approve_invoice", args: { invoice: "INV-4477", note: undefined } }]);
    expect(calls("reject it because they billed 20 units we never received")).toEqual([
      { name: "reject_invoice", args: { invoice: undefined, note: "they billed 20 units we never received" } },
    ]);
    expect(calls("undo that")).toEqual([{ name: "undo_last", args: {} }]);
    expect(calls("Always hold quantity variance over 5%")).toEqual([{ name: "create_hold_rule", args: { kind: "quantity", threshold_pct: 5 } }]);
    expect(calls("how are we doing?")).toEqual([{ name: "get_metrics", args: {} }]);
  });

  it("refuses bulk approval and asks", () => {
    expect(typeof calls("approve them all")).toBe("string");
  });

  it("resolves invoice references", () => {
    expect(resolveInvoiceRef("tell me about inv-4466")).toBe("INV-4466");
    expect(resolveInvoiceRef("what about KPC-42")).toBe("INV-4474");
    expect(resolveInvoiceRef("invoice 9999")).toBeNull();
  });
});

describe("write guard", () => {
  it("only approves when the user asked to approve", () => {
    expect(asksToApprove("approve it")).toBe(true);
    expect(asksToApprove("go ahead and post it")).toBe(true);
    expect(asksToApprove("why is it held?")).toBe(false);
    expect(asksToApprove("don't pay it")).toBe(false);
    expect(asksToReject("don't pay it")).toBe(true);
  });
});
