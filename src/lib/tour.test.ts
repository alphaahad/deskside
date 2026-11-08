import { describe, expect, it } from "vitest";
import { guide, highlight, type TourInput } from "./tour";

const base = (): TourInput => ({
  person: { id: "priya", role: "clerk" },
  status: { pending: 0, mailWaiting: true, mailDelivered: false },
  held: [{ invoiceId: "INV-4466" }, { invoiceId: "INV-4471" }],
  rules: [],
  events: [],
  messages: [],
});
const ev = (id: number, type: string, extra: Partial<TourInput["events"][number]> = {}) => ({ id, type, source: "chat", summary: "", undoes: null, ...extra });
const explained = { author: "agent", cards: [{ type: "explain", ex: { status: "held" } }] };

describe("walkthrough", () => {
  it("waits while Meera is still reading, then starts with the 4471 question", () => {
    const s = { ...base(), held: [], status: { pending: 12, mailWaiting: false, mailDelivered: false } };
    expect(guide(s).guide.state).toBe("waiting");
    const g = guide(base()).guide;
    expect(g.state === "step" && g.step.id).toBe("ask");
    expect(highlight(g)).toBe("Why is invoice 4471 on hold?");
  });

  it("follows the demo path to the end", () => {
    const s = base();
    s.messages.push(explained);
    expect(guide(s).current?.id).toBe("approve");
    s.events.push(ev(1, "approved"));
    expect(guide(s).current?.id).toBe("undo");
    s.events.push(ev(2, "undone", { undoes: 1 }));
    expect(guide(s).current?.id).toBe("limit");
    s.events.push(ev(3, "refused", { summary: "Refused: Priya (AP clerk) tried to approve INV-4477" }));
    const lead = guide(s).guide;
    expect(lead.state === "step" && lead.step.id).toBe("lead");
    expect(highlight(lead)).toBe("person-arjun");
    s.person = { id: "arjun", role: "lead" };
    expect(guide(s).current?.id).toBe("rule");
    s.rules.push({ active: true });
    const mail = guide(s);
    expect(mail.current?.id).toBe("mail");
    expect(highlight(mail.guide)).toBe("mail");
    s.events.push(ev(4, "held", { source: "rule" }));
    expect(guide(s).guide.state).toBe("done");
    expect(guide(s).done.size).toBe(7);
  });

  it("asks you to switch back to the clerk if you jumped to Arjun early", () => {
    const s = base();
    s.messages.push(explained);
    s.events.push(ev(1, "approved"), ev(2, "undone", { undoes: 1 }));
    s.person = { id: "arjun", role: "lead" };
    const g = guide(s).guide;
    expect(g.state === "step" && g.step.id).toBe("limit");
    expect(g.state === "step" && g.action).toEqual({ kind: "person", id: "priya", label: "Switch to Priya" });
  });

  it("counts steps done out of order, and offers a reset if the mail came before the rule", () => {
    const s = base();
    s.rules.push({ active: true });
    s.status = { pending: 0, mailWaiting: false, mailDelivered: true };
    const r = guide(s);
    expect(r.done.has("rule")).toBe(true);
    expect(r.done.has("lead")).toBe(true);
    expect(r.current?.id).toBe("ask");
    s.messages.push(explained);
    s.events.push(ev(1, "approved"), ev(2, "undone", { undoes: 1 }), ev(3, "refused", { summary: "tried to approve" }));
    const g = guide(s).guide;
    expect(g.state === "step" && g.action.kind).toBe("reset");
  });

  it("waits for INV-4477 to be read before asking you to try it", () => {
    const s = { ...base(), status: { pending: 6, mailWaiting: false, mailDelivered: false } };
    s.messages.push(explained);
    s.events.push(ev(1, "approved"), ev(2, "undone", { undoes: 1 }));
    expect(guide(s).guide.state).toBe("waiting");
    s.held.push({ invoiceId: "INV-4477" });
    expect(guide(s).guide.state).toBe("step");
  });

  it("an undone rule doesn't count as an undone approval", () => {
    const s = base();
    s.events.push(ev(1, "rule_created"), ev(2, "undone", { undoes: 1 }));
    expect(guide(s).done.has("undo")).toBe(false);
  });
});
