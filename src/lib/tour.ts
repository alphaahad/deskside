// The first-run walkthrough, "Meera guides you". Pure: progress is derived from real desk state
// (events, rules, person, chat cards), never from clicks, so it works whichever way the visitor acts
// (chat, buttons, MCP), survives a refresh, and restarts with Reset demo.

export type TourStepId = "ask" | "approve" | "undo" | "limit" | "lead" | "rule" | "mail";

export type TourAction =
  | { kind: "send"; text: string }
  | { kind: "person"; id: "priya" | "arjun"; label: string }
  | { kind: "mail" }
  | { kind: "reset" };

export type TourStep = {
  id: TourStepId;
  label: string; // checklist line
  instruct: string; // what Meera asks you to do next
  takeaway: string; // what Meera says once it's done: why it matters
  action: TourAction;
  target: string; // data-tour value of the control to highlight
  needs?: "clerk" | "lead";
};

export const STEPS: TourStep[] = [
  {
    id: "ask", label: "Ask why INV-4471 is on hold",
    instruct: "Start with a question: ask me why INV-4471 is on hold.",
    takeaway: "Every claim I make comes with chips you can open: the exact invoice, PO and receipt lines, straight from the match, not from my wording.",
    action: { kind: "send", text: "Why is invoice 4471 on hold?" }, target: "Why is invoice 4471 on hold?",
  },
  {
    id: "approve", label: "Approve it in chat",
    instruct: "If a 6% price rise is fine by you, tell me to approve it.",
    takeaway: "Decided in chat, logged in the activity feed with its source and an undo. The time from my hold to your decision is what the metric measures.",
    action: { kind: "send", text: "approve it" }, target: "Approve it",
  },
  {
    id: "undo", label: "Undo it",
    instruct: "Changed your mind? Undo it: ask me, or use Undo on the card or in the feed.",
    takeaway: "Nothing I do is final. Undos count toward the reversal guardrail, so deciding in chat can't quietly make you careless.",
    action: { kind: "send", text: "Undo that" }, target: "Undo that",
  },
  {
    id: "limit", label: "Try INV-4477 (over your limit)", needs: "clerk",
    instruct: "Now ask me to approve INV-4477. It's ₹2.1 lakh, and your limit as a clerk is ₹1 lakh.",
    takeaway: "Limits live in code, not in my judgement. I refused, told you why, and flagged it for Arjun.",
    action: { kind: "send", text: "Approve 4477" }, target: "Approve 4477",
  },
  {
    id: "lead", label: "Switch to Arjun, the finance lead",
    instruct: "Sign in as Arjun, the finance lead (top right). Same chat, more authority.",
    takeaway: "You're Arjun now: no approval limit, and allowed to change how I work.",
    action: { kind: "person", id: "arjun", label: "Switch to Arjun" }, target: "person-arjun",
  },
  {
    id: "rule", label: "Teach a rule", needs: "lead",
    instruct: "Teach me a standing rule: always hold quantity variance over 5%. My default only holds above 10%.",
    takeaway: "Remembered as R-1, with who set it and where. Rules can only make me stricter, never looser.",
    action: { kind: "send", text: "Always hold quantity variance over 5%" }, target: "Always hold quantity variance over 5%",
  },
  {
    id: "mail", label: "Bring in new mail, watch the rule apply",
    instruct: "Bring in the new mail. One invoice is billed 7% over what was received, which my default would let through.",
    takeaway: "Held by R-1, citing the rule and who set it. Taught once in chat, applied the next time.",
    action: { kind: "mail" }, target: "mail",
  },
];

/** The slice of desk state the tour reads. */
export type TourInput = {
  person: { id: string; role: "clerk" | "lead" };
  status: { pending: number; mailWaiting: boolean; mailDelivered: boolean };
  held: { invoiceId: string }[];
  rules: { active: boolean }[];
  events: { id: number; type: string; source: string; summary: string; undoes: number | null }[];
  messages: { author: string; cards: { type: string; ex?: { status: string } }[] | null }[];
};

export function completed(s: TourInput): Set<TourStepId> {
  const done = new Set<TourStepId>();
  const byId = new Map(s.events.map((e) => [e.id, e]));
  if (s.messages.some((m) => m.author === "agent" && m.cards?.some((c) => c.type === "explain" && c.ex?.status === "held"))) done.add("ask");
  if (s.events.some((e) => e.type === "approved")) done.add("approve");
  if (s.events.some((e) => e.type === "undone" && e.undoes != null && byId.get(e.undoes)?.type === "approved")) done.add("undo");
  if (s.events.some((e) => e.type === "refused" && /tried to (approve|reject)/.test(e.summary))) done.add("limit");
  const rule = s.rules.some((r) => r.active);
  if (s.person.role === "lead" || rule) done.add("lead");
  if (rule) done.add("rule");
  if (s.events.some((e) => e.type === "held" && e.source === "rule")) done.add("mail");
  return done;
}

export type Guide =
  | { state: "waiting"; text: string }
  | { state: "step"; step: TourStep; index: number; takeaway: string | null; text: string; action: TourAction }
  | { state: "done"; takeaway: string; text: string };

/** What Meera's guide bubble says right now. */
export function guide(s: TourInput): { done: Set<TourStepId>; current: TourStep | null; guide: Guide } {
  const done = completed(s);
  const index = STEPS.findIndex((st) => !done.has(st.id));
  const current = index < 0 ? null : STEPS[index];
  const lastDone = [...STEPS].reverse().find((st) => done.has(st.id));
  const takeaway = lastDone?.takeaway ?? null;

  if (!current) {
    return { done, current, guide: { state: "done", takeaway: STEPS[STEPS.length - 1].takeaway, text: "That's the whole loop. Everything here is live, so ask me anything. Also try “Use from Claude”, and the two Next tabs at the top." } };
  }
  // A step about an invoice waits until Meera has actually read (and held) that invoice.
  const waitFor = current.id === "ask" ? "INV-4471" : current.id === "limit" ? "INV-4477" : null;
  if (waitFor && s.status.pending > 0 && !s.held.some((h) => h.invoiceId === waitFor)) {
    return {
      done, current,
      guide: {
        state: "waiting",
        text: current.id === "ask"
          ? "Give me a moment: I'm reading today's 20 invoices. I'll hold anything that doesn't match, and tell you where to start."
          : `${lastDone?.takeaway ?? ""} I'm still reading; INV-4477 is next up for you once I've got to it.`.trim(),
      },
    };
  }

  let text = current.instruct;
  let action: TourAction = current.action;
  if (current.needs === "clerk" && s.person.role !== "clerk") {
    text = `This one needs Priya, the clerk, so switch back to her first. ${current.instruct}`;
    action = { kind: "person", id: "priya", label: "Switch to Priya" };
  } else if (current.needs === "lead" && s.person.role !== "lead") {
    text = `Rules are for the finance lead, so switch to Arjun first. ${current.instruct}`;
    action = { kind: "person", id: "arjun", label: "Switch to Arjun" };
  } else if (current.id === "mail" && s.status.mailDelivered) {
    text = "The new mail already came in before the rule existed, so there's nothing left for it to catch. Reset the demo to see a rule apply next time.";
    action = { kind: "reset" };
  } else if (current.id === "mail" && !s.status.mailWaiting) {
    text = "I'm still reading the first batch. Once I'm done, bring in the new mail.";
  }
  return { done, current, guide: { state: "step", step: current, index, takeaway: index > 0 ? takeaway : null, text, action } };
}

/** The data-tour target to highlight on screen (a control id, or a suggestion chip's text). */
export function highlight(g: Guide): string | null {
  if (g.state !== "step") return null;
  const a = g.action;
  if (a.kind === "person") return `person-${a.id}`;
  if (a.kind === "mail") return "mail";
  if (a.kind === "send") return g.step.target;
  return null;
}
