// The trust model. Pure and deterministic: the model never decides who may do what.
// Every approve / reject / undo / rule change, from chat, a button or MCP, goes through authorize().
import type { Person } from "./types";
import { inr0 } from "./format";
import { people } from "./data/seed";

export type Action =
  | { kind: "decide"; decision: "approve" | "reject"; invoiceId: string; amount: number }
  | { kind: "undo"; actorOfOriginal: string; originalSummary: string }
  | { kind: "rule" };

export type Verdict = { allowed: true } | { allowed: false; reason: string; escalateTo?: Person };

const lead = () => people.find((p) => p.role === "lead")!;

export function authorize(who: Person, action: Action): Verdict {
  if (who.role === "lead") return { allowed: true };

  switch (action.kind) {
    case "decide":
      if (who.limit !== null && action.amount > who.limit) {
        return {
          allowed: false,
          reason: `You're signed in as ${who.title}; your approval limit is ${inr0(who.limit)} and ${action.invoiceId} is ${inr0(action.amount)}. Decisions above your limit need the finance lead.`,
          escalateTo: lead(),
        };
      }
      return { allowed: true };
    case "undo":
      if (action.actorOfOriginal !== who.name) {
        return { allowed: false, reason: `${action.originalSummary} was decided by ${action.actorOfOriginal}. You can undo your own decisions; undoing someone else's needs the finance lead.` };
      }
      return { allowed: true };
    case "rule":
      return { allowed: false, reason: `Changing hold rules changes policy for everyone, so it's limited to the finance lead. I can pass the suggestion to ${lead().name}.`, escalateTo: lead() };
  }
}
